var enclose = require('circle-enclose');

module.exports = layoutIsolateNodes;

function layoutIsolateNodes(nodes) {
  var r = nodes.length * 2; // todo: this should be based on node's radius

  nodes.forEach(function(node) {
    var nr = r * Math.random();
    var alpha = Math.PI * 2 * Math.random();
    node.x = nr * Math.cos(alpha);
    node.y = nr * Math.sin(alpha);
  });

  var size = enclose(nodes);

  nodes.forEach(function(node) {
    node.x -= size.x;
    node.y -= size.y;
  });

  return size;
}
