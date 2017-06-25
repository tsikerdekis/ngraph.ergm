module.exports = ergm;

var createGraph = require('ngraph.graph');
var countTriangles = require('./lib/metrics.js');

// For testing purposes
var G = createGraph();
var G = require('ngraph.generators').complete(4);

ergm(G);

function ergm(G) {


  return 1;
}

// Compute the probability weight on graph G
function compute_weight(G, edge_coeff, tri_coeff) {
    var edge_count = G.getLinksCount();
    var triangles = countTriangles(G);
    return Math.exp(edge_count * edge_coeff + triangles * tri_coeff)
}