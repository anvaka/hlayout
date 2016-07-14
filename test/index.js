var test = require('tap').test;
var createLayout = require('../');
var createMiserablesGraph = require('miserables').create;

test('it can run the layout', function(t) {
  var graph = createMiserablesGraph();
  var layout = createLayout(graph);
  layout.run();

  graph.forEachNode(function(node) {
    var position = layout.getNodePosition(node.id);

    t.ok(typeof position.x === 'number' &&
         typeof position.y === 'number',
         'Position is defined for ' + node.id);
  });

  t.end();
});
