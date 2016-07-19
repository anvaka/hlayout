var enclose = require('circle-enclose');

module.exports = layoutIsolateNodes;

function layoutIsolateNodes(nodes, r) {
  if (!r) r = 30;

  var nodeCount = nodes.length;
  var rows = Math.ceil(Math.sqrt(nodeCount));

  for (var i = 0; i < rows; ++i) {
    for (var j = 0; j < rows; ++j) {
      var index = i + j * rows;
      if (index < nodeCount) {
        var node = nodes[index];
        node.x = i * r;
        node.y = j * r;
      }
    }
  }

  var size = enclose(nodes);

  nodes.forEach(function(node) {
    node.x -= size.x;
    node.y -= size.y;
  });

  return size;
}
