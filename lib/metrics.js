// TODO: upgrade multiply with Strassen multiplication O(V^2) instead of O(V^3)

module.exports = {countTriangles,getNumberOfUndirectedEdges};


/**
 * Counts the number of unique triangles
 * @param {ngraph.graph} G
 * @return {Number} numberOfTriangles
 */
function countTriangles(G) {
    var A = buildAdjacencyMatrix(G);
    var nodeCount = A.length;
    
    var aux2 = new Array();
    var aux3 = new Array();
    
    //  Initialising aux matrices with 0
    for (var i = 0; i < nodeCount; i++) {
        aux2[i] = new Array();
        aux3[i] = new Array();
        for (var j = 0; j < nodeCount; j++) {
            aux2[i][j] = 0;
            aux3[i][j] = 0;
        }
    }
    
    // A^2 product
    aux2 = multiply(A,A,aux2);
    
    // A^3 product
    aux3 = multiply(A, aux2, aux3);
    
    var trace = getTrace(aux3);
    return trace / 6;
}

/**
 * Builds Adjacency Matrix
 * @param {ngraph.graph} G
 * @return {Array} A
 */
function buildAdjacencyMatrix(G) {
    var nodeCount = G.getNodesCount();    
    var A = new Array();
    var nodes = [];
    G.forEachNode(function(node){
        nodes.push(node.id);
    });
    
    for (var i = 0; i < nodeCount; i++) {
        A[i] = new Array();
        for (var j = 0; j < nodeCount; j++) {
            //if (G.getLink(i,j) != null || G.getLink(j,i) != null) {
            if (G.getLink(nodes[i],nodes[j]) != null || G.getLink(nodes[j],nodes[i]) != null) {
                A[i][j] = 1;
            } else {
                A[i][j] = 0;
            }
        }
    }
    
    return A;
}


/**
 * Multiply matrices 
 * @param {Array} A
 * @param {Array} B
 * @param {Array} C
 * @return {Array} C
 */
function multiply(A, B, C) {
    var lengthA = A.length;
    var lengthB = B.length;
    var lengthC = C.length;
    for (var i = 0; i < lengthA; i++)
    {
        for (var j = 0; j < lengthB; j++)
        {
            C[i][j] = 0;
            for (var k = 0; k < lengthC; k++)
                C[i][j] += A[i][k]*B[k][j];
        }
    }
    return C;
}

/**
 * Sum of diagonal elements for 2D Matrix
 * @param {Array} A
 * @return {Number} trace
 */
function getTrace(A) {
    var trace = 0;
    for (var i = 0; i < A.length; i++)
        trace += A[i][i];
    return trace;
}

/**
 * Return undirected number of edges. Needed since ngraph does not support undirected mode
 * @param {ngraph.graph} G
 * @return {Number} Undirected edges
 */
function getNumberOfUndirectedEdges(G) {
    var edge_list = new Array();
    var nodes = [];
    G.forEachNode(function(node){
        nodes.push(node.id);
    });
    
    for (var i = 0; i < G.getNodesCount(); i++) {
        for (var j = i; j < G.getNodesCount(); j++) {
            if (i != j) {
                if (G.getLink(nodes[i],nodes[j]) != null || G.getLink(nodes[j],nodes[i]) != null) {
                    edge_list.push([nodes[i],nodes[j]]);
                }
            }
        }
    }
    return edge_list.length;
}