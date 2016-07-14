var enclose = require('circle-enclose');
var force = require('d3-force');

module.exports = internalLayout;

/**
 * Given d3 version of the graph performs the laout
 */
function internalLayout(dgraph) {
  var iterationsCount = 100; // TODO: This should be a function of dgraph.nodes.length?

  var simulation = force.forceSimulation(dgraph.nodes)
      .force('charge', force.forceManyBody().strength(manyBodyStrength))
      .force('link', force.forceLink(dgraph.edges).distance(linkDistance))
      .force('collide', force.forceCollide(collideCircle).strength(1));

  simulation.alphaDecay(0);

  simulation.stop();

  for (var i = 0; i < iterationsCount; ++i) {
    simulation.tick();
  }

  var size = enclose(dgraph.nodes);
  dgraph.nodes.forEach(function (node) {
    node.x -= size.x;
    node.y -= size.y;
  });

  return size;
}

function collideCircle(node) {
  return (node.r || 5) * 1.2;
}

function linkDistance(link) {
  if (link.source.r === undefined || link.target.r === undefined) return 80;
  var sum = link.source.r + link.target.r;
  return sum + 0.1 * sum;
}

function manyBodyStrength(node) {
  var r = node.r || 5;
  return -r * 8;
}
