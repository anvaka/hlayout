module.exports = createLayout;

var internalLayout = require('./lib/internalLayout.js');
var layoutIsolateNodes = require('./lib/layoutIsolateNodes.js');
var log = require('./lib/log.js');
var detectClusters = require('ngraph.louvain');
var coarsen = require('ngraph.coarsen');

function createLayout(graph) {
  var topLayerGraph;
  var globalPos;
  var topLayout;
  // what's the radius of a single node?
  var individualRadius = 30;

  // How many layers we found
  var depth = 0;

  var api = {
    getNodePosition: getNodePosition,
    getHierarchy: getHierarchy,
    getDepth: getDepth,
    getGroupsAtLevel: getGroupsAtLevel,
    run: run
  };

  return api;

  function getDepth() {
    return depth;
  }

  function getGroupsAtLevel(level) {
    var groups = Object.create(null);

    renderLayer(topLayout.dgraph.nodes, 0);

    return groups;

    function renderLayer(nodes, currentLevel, cluster) {
      nodes.forEach(function(node, idx) {
        if (currentLevel === level) {
          cluster = idx;
        }
        if (node.dgraph) {
          renderLayer(node.dgraph.nodes, currentLevel + 1, cluster);
        } else {
          groups[node.id] = cluster
        }
      });
    }
  }

  function getHierarchy() {
    var size = topLayout.size;
    var root = {
      x: -size.x,
      y: -size.y,
      r: size.r
    }

    appendChildren(root, topLayout.dgraph.nodes);
    flatten(root);

    return root;

    function appendChildren(parent, nodes) {
      if (!nodes) return;

      nodes.forEach(function(node) {
        if (!node.dgraph) return; // this is a leaf

        var child = {
          x: parent.x + node.x,
          y: parent.y + node.y,
          r: node.r
        };

        if (!parent.children) parent.children = [child];
        else parent.children.push(child);
        // traverse down
        appendChildren(child, node.dgraph.nodes);
      });
    }

    function flatten(root) {
      if (!root.children) return;

      if (root.children.length === 1) {
        root.children = root.children[0].children;
        flatten(root);
      } else {
        root.children.forEach(function(child) {
          flatten(child);
        });
      }
    }
  }

  function getNodePosition(nodeId) {
    return globalPos[nodeId];
  }

  function run() {
    if (graph.getNodesCount() === 0) {
      // no nodes - no layout.
      return;
    }

    log('Running clustering algorithm on graph. This may take a while...');

    topLayerGraph = graph;
    var currentLayer = 0;

    do {
      var clusters = detectClusters(topLayerGraph);
      var communityGraph = coarsen(topLayerGraph, clusters);

      log('Found: ' + communityGraph.getNodesCount() + ' communities at layer ' + currentLayer);
      log('Performing layout of each community node');

      communityGraph.forEachNode(function(node) {
        node.data.layout = layoutCommunity(topLayerGraph, node);
      });

      topLayerGraph = communityGraph;

      currentLayer += 1;
      // If there is no way we can produce next level community graph - we are done.
    } while (clusters.canCoarse());

    depth = currentLayer - 1;

    log('Reached maximum clustering level. Performing bottom to top layout');

    initPositions();
  }

  function initPositions() {
    globalPos = Object.create(null)

    var nodeSet = new Set();
    topLayerGraph.forEachNode(function(node) {
      nodeSet.add(node.id);
    });

    topLayout = layoutCommunity(topLayerGraph, { data: nodeSet });

    var size = topLayout.size;

    renderLayer(topLayout.dgraph.nodes, -size.x, -size.y);

    function renderLayer(nodes, x, y) {
      nodes.forEach(function(node) {
        if (node.dgraph) {
          renderLayer(node.dgraph.nodes, x + node.x, y + node.y);
        } else {
          globalPos[node.id] = {
            x: node.x + x,
            y: node.y + y
          };
        }
      });
    }
  }

  function layoutCommunity(srcGraph, communityNode) {
    var internalGraph = buildInternalGraph(srcGraph, communityNode.data, individualRadius);
    var size;
    if (internalGraph.edges.length === 0) {
      var isolateNodes = internalGraph.nodes;
      log('Performing layout of isolate nodes. Found ' + isolateNodes.length + ' nodes');
      size = layoutIsolateNodes(isolateNodes, individualRadius);
      log('Done');
    } else {
      size = internalLayout(internalGraph);
    }

    return {
      size: size,
      dgraph: internalGraph
    }
  }
}


/**
 * Given ngraph instance and set of nodes creates a d3 version of the the graph
 * that contains only nodes from given set. Connections between nodes in this
 * set are the same as in the original graph.
 */
function buildInternalGraph(srcGraph, nodesSet, individualRadius) {
  var nodes = [];
  var edges = [];
  var idToNode = Object.create(null);

  nodesSet.forEach(addNode);
  nodesSet.forEach(addInternalEdges);

  return {
    nodes: nodes,
    edges: edges
  };

  function addNode(srcNodeId) {
    var srcNode = srcGraph.getNode(srcNodeId)

    var nodeIndex = nodes.length;
    var layout = srcNode.data && srcNode.data.layout;
    var size = layout && layout.size;

    var node = {
      id: srcNodeId,
      index: nodeIndex,
      r: size ? size.r : individualRadius
    };

    if (layout && layout.dgraph) {
      node.dgraph = layout.dgraph;
    }

    idToNode[srcNodeId] = node;

    nodes.push(node);
  }

  function addInternalEdges(srcNodeId) {
    srcGraph.forEachLinkedNode(srcNodeId, appendLinkIfInternal, true);

    function appendLinkIfInternal(otherNode, link) {
      if (!nodesSet.has(otherNode.id)) return; // this edge goes outside. Ignore it.

      var link = {
        source: idToNode[srcNodeId],
        target: idToNode[otherNode.id]
      }

      edges.push(link);
    }
  }
}
