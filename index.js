module.exports = createLayout;

var internalLayout = require('./lib/internalLayout.js');
var log = require('./lib/log.js');
var detectClusters = require('ngraph.louvain');
var coarsen = require('ngraph.coarsen');

function createLayout(graph) {
  var layers;
  var globalPos;
  var topLayout;

  var api = {
    getNodePosition: getNodePosition,
    getTopLayout: function() { return topLayout; },
    run: run
  };


  return api;

  function getNodePosition(nodeId) {
    return globalPos[nodeId];
  }

  function run() {
    log('Running clustering algorithm on graph. This may take a while...');

    var srcGraph = graph;
    var clusters = detectClusters(srcGraph);
    layers = [{
        graph: srcGraph,
        clusters: clusters
      }];

    while(clusters.canCoarse()) {
      log('Layer ' + layers.length + ' completed. Trying next level...');

      var communityGraph = coarsen(srcGraph, clusters);

      communityGraph.forEachNode(function(node) {
        node.data.layout = layoutCommunity(srcGraph, node);
      });

      layers.push({
        graph: communityGraph,
        clusters: clusters
      });

      clusters = detectClusters(communityGraph);
      srcGraph = communityGraph;
    }

    log('Reached maximum clustering level. Performing bottom to top layout');
    initPositions();
  }

  function initPositions() {
    globalPos = Object.create(null)
    var topLayer = layers[layers.length - 1];

    var nodeSet = new Set();
    topLayer.graph.forEachNode(function(node) { nodeSet.add(node.id); });

    topLayout = layoutCommunity(topLayer.graph, {
      data: nodeSet
    });

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
    var internalGraph = buildInternalGraph(srcGraph, communityNode.data); 
    var size = internalLayout(internalGraph)

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
function buildInternalGraph(srcGraph, nodesSet) {
  var nodes = [];
  var edges = [];
  var idToNode = Object.create(null);

  nodesSet.forEach(addNode);
  nodesSet.forEach(addInternalEdges);

  function addNode(srcNodeId) {
    var srcNode = srcGraph.getNode(srcNodeId)

    var nodeIndex = nodes.length;
    var layout = srcNode.data && srcNode.data.layout;
    var size = layout && layout.size;

    var node = {
      id: srcNodeId,
      index: nodeIndex,
      r: size ? size.r : 5
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
      if (!nodesSet.has(otherNode.id)) return; // this edge goes outtside. Ignore it.
      var link = {
        source: idToNode[srcNodeId],
        target: idToNode[otherNode.id]
      }

      edges.push(link);
    }
  }

  return {
    nodes: nodes,
    edges: edges
  };
}
