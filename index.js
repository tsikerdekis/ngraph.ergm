//TODO: flexible parameter selection and estimation instead of the fixed edge and triangle (two parameters)

module.exports = ergm;

var createGraph = require('ngraph.graph');
var countTriangles = require('./lib/metrics.js');
var gaussian = require('gaussian');

// For testing purposes
var G = createGraph();
var G = require('ngraph.generators').complete(4);

console.log(ergm(G));

/**
 * Use MCMC to sample possible coefficients, and return the best fits.
 * @param {ngraph.graph} G
 * @param {Number} coefficientSamples
 * @param {Number} graphSamples
 * @param {Boolean} Return posterior distribution
 * @return {Array} (best_edge_coeff, best_triangle_coeff, best_p)
 * @return {Two-Dimensional Array} (edge_coeffs, triangle_coeffs, probs)
 */
function ergm(G, coeffSamples = 10, graphSamples = 10, returnAll = false) {
    // Init
    var edgeCoeffs = [0];
    var triangleCoeffs = [0];
    var probs = new Array();
 
    while (probs.length < coeffSamples) {
        // Larger variance early on, smaller later on. It helps if our initial choices land far away from the actual distribution coefficients
        var w = coeffSamples / 50;
        var s = Math.sqrt( w / probs.length );

        // Sample based on previous coefficient and a random gaussian pick
        var edgeCoeff = edgeCoeffs[-1] + gaussian(0, s).ppf(Math.random());
        var triangleCoeff = triangleCoeffs[-1] + gaussian(0, s).ppf(Math.random());
        
        // Check how likely the observed graph is under this distribution:
        var graphList = mcmc(G, edgeCoeff, triangleCoeff, graphSamples);
        var sumWeight = sumWeights(graphList, edgeCoeff, triangleCoeff);
        var p = computeWeight(G, edgeCoeff, triangleCoeff) / sumWeight;
        
        // Decide whether to accept the new coefficients
        if (p > probs[-1] || Math.random() < (p / probs[-1])) {
            edgeCoeffs.push(edgeCoeff);
            triangleCoeffs.push(triangleCoeff);
            probs.push(p);
        } else {
            edgeCoeffs.push(edgeCoeffs[-1]);
            triangleCoeffs.push(triangleCoeffs[-1]);
            probs.push(probs[1]);
        }
    }
    
    // Return either the best values, or all of them:
    if (!returnAll) {
        i = Math.max.apply(null, probs);
        bestP = probs[i]
        bestEdgeCoeff = edgeCoeffs[i]
        bestTriangleCoeff = triangleCoeffs[i]
        return (bestEdgeCoeff, bestTriangleCoeff, bestP)
    } else {
        return (edgeCoeffs, triangleCoeffs, probs)
    }
}

/**
 * Sum the probability weights on every graph in graphs
 * @param {Array ngraph.graph} graphList
 * @param {Number} edge_coeff
 * @param {Number} tri_coeff
 * @return {Number} total weight
 */
function sumWeights(graphList, edge_coeff, tri_coeff){
    var total = 0;
    graphList.forEach(function(graph) {
        total += computeWeight(graph, edge_coeff, tri_coeff)
    });
    return total;
}

/**
 * Use MCMC to generate a sample of networks from an ERG distribution.
 * @param {ngraph.graph} G
 * @param {Number} edge_coeff
 * @param {Number} tri_coeff
 * @param {Number} samples
 * @return {Array ngraph.graph} graphList
 */
function mcmc(G, edge_coeff, triangle_coeff, samples){
    n = samples
    v = nodeCount
    
    var nodeCount = G.getNodesCount();
    var edgeCount = G.getLinksCount();
    
    // Probability of random edge existing (graph density)
    var p = 2 * Math.abs(edgeCount) / ( Math.abs(nodeCount) * ( Math.abs(nodeCount) - 1 )  );
    
    // Create a random graph from which the process of sampling will start
    var currentGraph = require('ngraph.generators').wattsStrogatz(nodeCount, (nodeCount*p)-1, 0.02); // subtracting 1 in case p = 1
    var currentWeight = computeWeight(G, edge_coeff, triangle_coeff);
    
    graphList = []
    while (graphList.length < samples) {
        var newGraph = permuteGraph(currentGraph)
        var newWeight = computeWeight(newGraph, edge_coeff, triangle_coeff)
        if (newWeight > currentWeight || Math.random() < (newWeight/currentWeight)) {
            graphList.push(newGraph)
            currentWeight = newWeight
        }
    }
    return graphList;
}

/**
 * Compute the propability weight for a graph (this is a proportional exponential estimate)
 * @param {ngraph.graph} G
 * @param {Number} edge_coeff
 * @param {Number} tri_coeff
 * @return {Number} numberOfTriangles
 */
function computeWeight(G, edge_coeff, tri_coeff) {
    var edge_count = G.getLinksCount();
    var triangles = countTriangles(G);
    return Math.exp(edge_count * edge_coeff + triangles * tri_coeff)
}

/**
 * Propose a new graph with a random edge added (if absent) or removed (if present). The proposal distribution is symmetric..
 * @param {ngraph.graph} G
 * @return {ngraph.graph} new random graph G
 */
function permuteGraph(G) {
    var edge_list = new Array();
    var nodesCount = G.getNodesCount();
    
    // Create edge_list - a list with all possible edges
    for (var i = 0; i < nodesCount; i++) {
        for (var j = 0; j < nodesCount; j++) {
            if (i != j) {
                edge_list.push([i,j]);
            }
        }
    }
    
    var rand = edge_list[Math.floor(Math.random() * edge_list.length)];
    var G_prime = G;
    
    if (G.getLink(rand[0],rand[1]) == null && G.getLink(rand[0],rand[1]) == null) {
        G_prime.addLink(rand[0],rand[1]);
    } else {
        G_prime.removeLink(G.getLink(rand[0],rand[1]));
        G_prime.removeLink(G.getLink(rand[1],rand[0]));
    }
    
    return G_prime;
}