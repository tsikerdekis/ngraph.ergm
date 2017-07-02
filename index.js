//TODO: flexible parameter selection and estimation instead of the fixed edge and triangle (two parameters)
//TODO: problem: this is not deep copy: var G_prime = G; look for it in the code

module.exports = ergm;

var createGraph = require('ngraph.graph');
var metrics = require('./lib/metrics.js');
var gaussian = require('gaussian');

// For testing purposes
//var G = createGraph();
//var G = require('ngraph.generators').complete(4);
var florentine = require('./datasets/florentine.js');
var G = florentine();
console.log(metrics.countTriangles(G));
console.log(metrics.getNumberOfUndirectedEdges(G));
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
function ergm(G, coeffSamples = 100, graphSamples = 1000, returnAll = false) {
    // Init
    var edgeCoeffs = [0];
    var triangleCoeffs = [0];
    var probs = [0];
 
    while (probs.length < coeffSamples) {
        // Larger variance early on, smaller later on. It helps if our initial choices land far away from the actual distribution coefficients
        var w = coeffSamples / 50;
        var s = Math.sqrt( w / probs.length );

        // Sample based on previous coefficient and a random gaussian pick
        var edgeCoeff = edgeCoeffs[edgeCoeffs.length-1] + gaussian(0, s).ppf(Math.random());
        var triangleCoeff = triangleCoeffs[triangleCoeffs.length-1] + gaussian(0, s).ppf(Math.random());
        
        // Check how likely the observed graph is under this distribution:
        var graphList = mcmc(G, edgeCoeff, triangleCoeff, graphSamples);
        if (graphList != null) {
            var sumWeight = sumWeights(graphList, edgeCoeff, triangleCoeff);
            var p = computeWeight(G, edgeCoeff, triangleCoeff) / sumWeight;
            console.log(['#'+probs.length,edgeCoeff,triangleCoeff,computeWeight(G, edgeCoeff, triangleCoeff),sumWeight]);
        
            // Decide whether to accept the new coefficients
            if (p > probs[probs.length-1] || Math.random() < (p / probs[probs.length-1])) {
                edgeCoeffs.push(edgeCoeff);
                triangleCoeffs.push(triangleCoeff);
                probs.push(p);
            } else {
                edgeCoeffs.push(edgeCoeffs[edgeCoeffs.length-1]);
                triangleCoeffs.push(triangleCoeffs[triangleCoeffs.length-1]);
                probs.push(probs[1]);
            }
        }
    }
    
    // Return either the best values, or all of them:
    if (returnAll == false) {
        var i = Math.max.apply(null, probs);
        i = probs.indexOf(i);
        var bestP = probs[i];
        var bestEdgeCoeff = edgeCoeffs[i];
        var bestTriangleCoeff = triangleCoeffs[i];
        return [bestEdgeCoeff, bestTriangleCoeff, bestP];
    } else {
        return [edgeCoeffs, triangleCoeffs, probs];
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
 * @param {Number} tolerance
 * @return {Array ngraph.graph} graphList
 */
function mcmc(G, edge_coeff, triangle_coeff, samples, tolerance = 10000){
    if (tolerance <= samples) {
        tolerance = samples + 100; // tolerance needs to always be above samples
    }
    
    var nodeCount = G.getNodesCount();
    var edgeCount = metrics.getNumberOfUndirectedEdges(G);
    
    // Probability of random edge existing (graph density)
    var p = 2 * Math.abs(edgeCount) / ( Math.abs(nodeCount) * ( Math.abs(nodeCount) - 1 )  );
    
    // Create a random graph from which the process of sampling will start
    var currentGraph = cloneNgraph(G);
    var currentWeight = computeWeight(G, edge_coeff, triangle_coeff);
    
    var graphList = []
    var trials = 0;
    while (graphList.length < samples && trials < tolerance) {
        var newGraph = permuteGraph(currentGraph);
        var newWeight = computeWeight(newGraph, edge_coeff, triangle_coeff);
        if (newWeight >= currentWeight || Math.random() < (newWeight/currentWeight)) {
            graphList.push(newGraph);
            currentWeight = newWeight;
        }
        trials += 1;
    }
    if (trials >= tolerance) {
        console.log("Specified model did not converge.");
        return null;
    } else {
        return graphList;
    }
    
}

/**
 * Compute the propability weight for a graph (this is a proportional exponential estimate)
 * @param {ngraph.graph} G
 * @param {Number} edge_coeff
 * @param {Number} tri_coeff
 * @return {Number} numberOfTriangles
 */
function computeWeight(G, edge_coeff, tri_coeff) {
    var edge_count = metrics.getNumberOfUndirectedEdges(G);
    var triangles = metrics.countTriangles(G);
    return Math.exp((edge_count * edge_coeff) + (triangles * tri_coeff));
}

/**
 * Propose a new graph with a random edge added (if absent) or removed (if present). The proposal distribution is symmetric..
 * @param {ngraph.graph} G
 * @return {ngraph.graph} new random graph G
 */
function permuteGraph(G) {
    var edge_list = new Array();
    var nodes = [];
    G.forEachNode(function(node){
        nodes.push(node.id);
    });
    var nodesCount = nodes.length;
    
    // Create edge_list - a list with all possible edges
    for (var i = 0; i < G.getNodesCount(); i++) {
        for (var j = i; j < G.getNodesCount(); j++) {
            if (i != j) {
                edge_list.push([nodes[i],nodes[j]]);
            }
        }
    }
    
    var rand = edge_list[Math.floor(Math.random() * edge_list.length)];
    //var G_prime = Object.clone(G, true)
    //console.log(Object.is(G_prime,G));
    //var G_prime = G;
    var G_prime = cloneNgraph(G);
    
    if (G_prime.getLink(rand[0],rand[1]) == null && G_prime.getLink(rand[1],rand[0]) == null) {
        G_prime.addLink(rand[0],rand[1]);
    } else {
        G_prime.removeLink(G.getLink(rand[0],rand[1]));
        G_prime.removeLink(G.getLink(rand[1],rand[0]));
    }
    //console.log([G_prime.getLinksCount(),G.getLinksCount()]);
    
    return G_prime;
}

/**
 * Produce the mean of an array
 * @param {Array} list
 * @return {Number} mean
 */
function mean(list) {
    var total = 0;
    for (var i=0; i < list.length; i++) {
        total += list[i];
    }
    return total / list.length;
}

/**
 * Deep copies the graph
 * @param {ngraph.graph} Graph
 * @return {ngraph.graph} Graph
 */
function cloneNgraph(G) {
    var G_prime = createGraph();
    
    G.forEachLink(function(link) {
        G_prime.addLink(link.fromId,link.toId)
    });
    
    return G_prime;
}