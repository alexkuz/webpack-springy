/**
 * Springy v2.7.1
 *
 * Copyright (c) 2010-2013 Dennis Hotson
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

var seed = Math.random() * 999999;

function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

import raf from 'raf';

export const Graph = function(json) {
	this.nodeSet = {};
	this.nodes = [];
	this.edges = [];
	this.adjacency = {};

	this.nextNodeId = 0;
	this.nextEdgeId = 0;
	this.eventListeners = [];

	if (json) {
		this.loadJSON(json);
	}
};

export const Node = function(id, data) {
	this.id = id;
	this.data = (data !== undefined) ? data : {};

// Data fields used by layout algorithm in this file:
// this.data.mass
// Data used by default renderer in springyui.js
// this.data.label
};

export const Edge = function(id, source, target, data) {
	this.id = id;
	this.source = source;
	this.target = target;
	this.data = (data !== undefined) ? data : {};

// Edge data field used by layout alorithm
// this.data.length
// this.data.type
};

Graph.prototype.addNode = function(node) {
	if (!(node.id in this.nodeSet)) {
		this.nodes.push(node);
	}

	this.nodeSet[node.id] = node;

	this.notify();
	return node;
};

Graph.prototype.addNodes = function() {
	// accepts variable number of arguments, where each argument
	// is a string that becomes both node identifier and label
	for (var i = 0; i < arguments.length; i++) {
		var name = arguments[i];
		var node = new Node(name, {label:name});
		this.addNode(node);
	}
};

Graph.prototype.addEdge = function(edge) {
	var exists = false;
	this.edges.forEach(function(e) {
		if (edge.id === e.id) { exists = true; }
	});

	if (!exists) {
		this.edges.push(edge);
	}

	if (!(edge.source.id in this.adjacency)) {
		this.adjacency[edge.source.id] = {};
	}
	if (!(edge.target.id in this.adjacency[edge.source.id])) {
		this.adjacency[edge.source.id][edge.target.id] = [];
	}

	exists = false;
	this.adjacency[edge.source.id][edge.target.id].forEach(function(e) {
			if (edge.id === e.id) { exists = true; }
	});

	if (!exists) {
		this.adjacency[edge.source.id][edge.target.id].push(edge);
	}

	this.notify();
	return edge;
};

Graph.prototype.addEdges = function() {
	// accepts variable number of arguments, where each argument
	// is a triple [nodeid1, nodeid2, attributes]
	for (var i = 0; i < arguments.length; i++) {
		var e = arguments[i];
		var node1 = this.nodeSet[e[0]];
		if (node1 === undefined) {
			throw new TypeError("invalid node name: " + e[0]);
		}
		var node2 = this.nodeSet[e[1]];
		if (node2 === undefined) {
			throw new TypeError("invalid node name: " + e[1]);
		}
		var attr = e[2];

		this.newEdge(node1, node2, attr);
	}
};

Graph.prototype.newNode = function(data) {
	var node = new Node(this.nextNodeId++, data);
	this.addNode(node);
	return node;
};

Graph.prototype.newEdge = function(source, target, data) {
	var edge = new Edge(this.nextEdgeId++, source, target, data);
	this.addEdge(edge);
	return edge;
};


// add nodes and edges from JSON object
Graph.prototype.loadJSON = function(json) {
/**
Springy's simple JSON format for graphs.

historically, Springy uses separate lists
of nodes and edges:

	{
		"nodes": [
			"center",
			"left",
			"right",
			"up",
			"satellite"
		],
		"edges": [
			["center", "left"],
			["center", "right"],
			["center", "up"]
		]
	}

**/
	// parse if a string is passed (EC5+ browsers)
	if (typeof json === 'string' || json instanceof String) {
		json = JSON.parse( json );
	}

	if ('nodes' in json || 'edges' in json) {
		this.addNodes.apply(this, json['nodes']);
		this.addEdges.apply(this, json['edges']);
	}
}


// find the edges from node1 to node2
Graph.prototype.getEdges = function(node1, node2) {
	if (node1.id in this.adjacency
		&& node2.id in this.adjacency[node1.id]) {
		return this.adjacency[node1.id][node2.id];
	}

	return [];
};

// remove a node and it's associated edges from the graph
Graph.prototype.removeNode = function(node) {
	if (node.id in this.nodeSet) {
		delete this.nodeSet[node.id];
	}

	for (var i = this.nodes.length - 1; i >= 0; i--) {
		if (this.nodes[i].id === node.id) {
			this.nodes.splice(i, 1);
		}
	}

	this.detachNode(node);
};

// removes edges associated with a given node
Graph.prototype.detachNode = function(node) {
	var tmpEdges = this.edges.slice();
	tmpEdges.forEach(function(e) {
		if (e.source.id === node.id || e.target.id === node.id) {
			this.removeEdge(e);
		}
	}, this);

	this.notify();
};

// remove a node and it's associated edges from the graph
Graph.prototype.removeEdge = function(edge) {
	for (var i = this.edges.length - 1; i >= 0; i--) {
		if (this.edges[i].id === edge.id) {
			this.edges.splice(i, 1);
		}
	}

	for (var x in this.adjacency) {
		for (var y in this.adjacency[x]) {
			var edges = this.adjacency[x][y];

			for (var j=edges.length - 1; j>=0; j--) {
				if (this.adjacency[x][y][j].id === edge.id) {
					this.adjacency[x][y].splice(j, 1);
				}
			}

			// Clean up empty edge arrays
			if (this.adjacency[x][y].length === 0) {
				delete this.adjacency[x][y];
			}
		}

		// Clean up empty objects
		if (isEmpty(this.adjacency[x])) {
			delete this.adjacency[x];
		}
	}

	this.notify();
};

/* Merge a list of nodes and edges into the current graph. eg.
var o = {
	nodes: [
		{id: 123, data: {type: 'user', userid: 123, displayname: 'aaa'}},
		{id: 234, data: {type: 'user', userid: 234, displayname: 'bbb'}}
	],
	edges: [
		{from: 0, to: 1, type: 'submitted_design', directed: true, data: {weight: }}
	]
}
*/
Graph.prototype.merge = function(data) {
	var nodes = [];
	data.nodes.forEach(function(n) {
		nodes.push(this.addNode(new Node(n.id, n.data)));
	}, this);

	data.edges.forEach(function(e) {
		var from = nodes[e.from];
		var to = nodes[e.to];

		var id = (e.directed)
			? (e.type + "-" + from.id + "-" + to.id)
			: (from.id < to.id) // normalise id for non-directed edges
				? e.type + "-" + from.id + "-" + to.id
				: e.type + "-" + to.id + "-" + from.id;

		var edge = this.addEdge(new Edge(id, from, to, e.data));
		edge.data.type = e.type;
	}, this);
};

Graph.prototype.filterNodes = function(fn) {
	var tmpNodes = this.nodes.slice();
	tmpNodes.forEach(function(n) {
		if (!fn(n)) {
			this.removeNode(n);
		}
	}, this);
};

Graph.prototype.filterEdges = function(fn) {
	var tmpEdges = this.edges.slice();
	tmpEdges.forEach(function(e) {
		if (!fn(e)) {
			this.removeEdge(e);
		}
	}, this);
};


Graph.prototype.addGraphListener = function(obj) {
	this.eventListeners.push(obj);
};

Graph.prototype.notify = function() {
	this.eventListeners.forEach(function(obj){
		obj.graphChanged();
	});
};

// -----------
export const Layout = {
	ForceDirected: function(graph, stiffness, repulsion, damping, minEnergyThreshold) {
		this.graph = graph;
		this.stiffness = stiffness; // spring stiffness constant
		this.repulsion = repulsion; // repulsion constant
		this.damping = damping; // velocity damping factor
		this.minEnergyThreshold = minEnergyThreshold || 0.01; //threshold used to determine render stop

		this.nodePoints = {}; // keep track of points associated with nodes
		this.edgeSprings = {}; // keep track of springs associated with edges
	}
};

Layout.ForceDirected.prototype.point = function(node) {
	if (!(node.id in this.nodePoints)) {
		var mass = (node.data.mass !== undefined) ? node.data.mass : 1.0;
		this.nodePoints[node.id] = new Layout.ForceDirected.Point(Vector.random(), mass);
	}

	return this.nodePoints[node.id];
};

Layout.ForceDirected.prototype.spring = function(edge) {
	if (!(edge.id in this.edgeSprings)) {
		var length = (edge.data.length !== undefined) ? edge.data.length : 1.0;

		var existingSpring = false;

		var from = this.graph.getEdges(edge.source, edge.target);
		from.forEach(function(e) {
			if (existingSpring === false && e.id in this.edgeSprings) {
				existingSpring = this.edgeSprings[e.id];
			}
		}, this);

		if (existingSpring !== false) {
			return new Layout.ForceDirected.Spring(existingSpring.point1, existingSpring.point2, 0.0, 0.0);
		}

		var to = this.graph.getEdges(edge.target, edge.source);
		from.forEach(function(e){
			if (existingSpring === false && e.id in this.edgeSprings) {
				existingSpring = this.edgeSprings[e.id];
			}
		}, this);

		if (existingSpring !== false) {
			return new Layout.ForceDirected.Spring(existingSpring.point2, existingSpring.point1, 0.0, 0.0);
		}

		this.edgeSprings[edge.id] = new Layout.ForceDirected.Spring(
			this.point(edge.source), this.point(edge.target), length, this.stiffness
		);
	}

	return this.edgeSprings[edge.id];
};

// callback should accept two arguments: Node, Point
Layout.ForceDirected.prototype.eachNode = function(callback) {
	var t = this;
	this.graph.nodes.forEach(function(n){
		callback.call(t, n, t.point(n));
	});
};

// callback should accept two arguments: Edge, Spring
Layout.ForceDirected.prototype.eachEdge = function(callback) {
	var t = this;
	this.graph.edges.forEach(function(e){
		callback.call(t, e, t.spring(e));
	});
};

// callback should accept one argument: Spring
Layout.ForceDirected.prototype.eachSpring = function(callback) {
	var t = this;
	this.graph.edges.forEach(function(e){
		callback.call(t, t.spring(e));
	});
};


// Physics stuff
Layout.ForceDirected.prototype.applyCoulombsLaw = function() {
	var nodes = this.graph.nodes;
	var rep = this.repulsion;
	var i = 0, j = 0, x = 0, y = 0, z = 0, absx = 0, absy = 0, absz = 0, maxxyz = 0, k = 0;
	var magnitude = 0, distance = 0, factor = 0;
	var x1 = 0, y1 = 0, z1 = 0, m1 = 0, ax1 = 0, ay1 = 0, az1 = 0;
	var len = nodes.length;
	var xs = new Array(nodes.length);
	var ys = new Array(nodes.length);
	var zs = new Array(nodes.length);
	var ms = new Array(nodes.length);
	var axs = new Array(nodes.length);
	var ays = new Array(nodes.length);
	var azs = new Array(nodes.length);
	var points = new Array(nodes.length);
	var point;

	//console.time('prep');
	for (i = 0; i < len; i++) {
		point = this.point(nodes[i]);
		xs[i] = point.p.x;
		ys[i] = point.p.y;
		zs[i] = point.p.z;
		ms[i] = point.m;
		axs[i] = point.a.x;
		ays[i] = point.a.y;
		azs[i] = point.a.z;
		points[i] = point;
	}
	//console.timeEnd('prep');

	//console.time('coulombs');
	for (i = 0; i < len; i++) {
		x1 = xs[i];
		y1 = ys[i];
		z1 = zs[i];
		m1 = ms[i];
		ax1 = 0;
		ay1 = 0;
		az1 = 0;

		for (j = 0; j < i; j++) {
			x = x1 - xs[j];
			y = y1 - ys[j];
			z = z1 - zs[j];
			
			factor = 4 * rep / (x * x + y * y + z * z);

			// apply force to each end point
			axs[j] += - x * factor / ms[j];
			ays[j] += - y * factor / ms[j];
			azs[j] += - z * factor / ms[j];
			ax1 += x * factor / m1;
			ay1 += y * factor / m1;
			az1 += z * factor / m1;
		}

		axs[i] += ax1;
		ays[i] += ay1;
		azs[i] += az1;
	}
	//console.timeEnd('coulombs');

	//console.time('post');
	for (i = 0; i < len; i++) {
		points[i].a.x = axs[i];
		points[i].a.y = ays[i];
		points[i].a.z = azs[i];
	}
	//console.timeEnd('post');
};

Layout.ForceDirected.prototype.applyHookesLaw = function() {
	this.eachSpring(function(spring){
		var d = spring.point2.p.subtract(spring.point1.p); // the direction of the spring
		var displacement = spring.length - d.magnitude();
		var direction = d.normalise();

		// apply force to each end point
		spring.point1.applyForce(direction.multiply(spring.k * displacement * -0.5));
		spring.point2.applyForce(direction.multiply(spring.k * displacement * 0.5));
	});
};

Layout.ForceDirected.prototype.attractToCentre = function() {
	this.eachNode(function(node, point) {
		var direction = point.p.multiply(-1.0);
		point.applyForce(direction.multiply(this.repulsion / 50.0));
	});
};


Layout.ForceDirected.prototype.updateVelocity = function(timestep) {
	this.eachNode(function(node, point) {
		// Is this, along with updatePosition below, the only places that your
		// integration code exist?
		point.v = point.v.add(point.a.multiply(timestep)).multiply(this.damping);
		point.a = new Vector(0,0,0);
	});
};

Layout.ForceDirected.prototype.updatePosition = function(timestep) {
	this.eachNode(function(node, point) {
		// Same question as above; along with updateVelocity, is this all of
		// your integration code?
		point.p = point.p.add(point.v.multiply(timestep));
	});
};

// Calculate the total kinetic energy of the system
Layout.ForceDirected.prototype.totalEnergy = function(timestep) {
	var energy = 0.0;
	this.eachNode(function(node, point) {
		var speed = point.v.magnitude();
		energy += 0.5 * point.m * speed * speed;
	});

	return energy;
};

/**
 * Start simulation if it's not running already.
 * In case it's running then the call is ignored, and none of the callbacks passed is ever executed.
 */
Layout.ForceDirected.prototype.start = function(render, onRenderStop, onRenderStart) {
	var t = this;

	if (this._started) return;
	this._started = true;
	this._stop = false;

	if (onRenderStart !== undefined) { onRenderStart(); }

	raf(function step() {
		t.tick(0.03);

		if (render !== undefined) {
			render();
		}

		// stop simulation when energy of the system goes below a threshold
		if (t._stop || t.totalEnergy() < t.minEnergyThreshold) {
			t._started = false;
			if (onRenderStop !== undefined) { onRenderStop(); }
		} else {
			raf(step);
		}
	});
};

Layout.ForceDirected.prototype.stop = function() {
	this._stop = true;
}

Layout.ForceDirected.prototype.tick = function(timestep) {
	this.applyCoulombsLaw();
	this.applyHookesLaw();
	this.attractToCentre();
	this.updateVelocity(timestep);
	this.updatePosition(timestep);
};

// Find the nearest point to a particular position
Layout.ForceDirected.prototype.nearest = function(pos) {
	var min = {node: null, point: null, distance: null};
	var t = this;
	this.graph.nodes.forEach(function(n){
		var point = t.point(n);
		var distance = point.p.subtract(pos).magnitude();

		if (min.distance === null || distance < min.distance) {
			min = {node: n, point: point, distance: distance};
		}
	});

	return min;
};

// Vector
export const Vector = function(x, y, z) {
	this.x = x;
	this.y = y;
	this.z = z;
};

Vector.random = function() {
	console.log('random');
	return new Vector(
		10.0 * (random() - 0.5),
		10.0 * (random() - 0.5),
		10.0 * (random() - 0.5)
	);
};

Vector.prototype.add = function(v2) {
	return new Vector(this.x + v2.x, this.y + v2.y, this.z + v2.z);
};

Vector.prototype.subtract = function(v2) {
	return new Vector(this.x - v2.x, this.y - v2.y, this.z - v2.z);
};

Vector.prototype.multiply = function(n) {
	return new Vector(this.x * n, this.y * n, this.z * n);
};

Vector.prototype.divide = function(n) {
	return new Vector((this.x / n) || 0, (this.y / n) || 0, (this.z / n) || 0); // Avoid divide by zero errors..
};

Vector.prototype.magnitude = function() {
	return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
};

Vector.prototype.normalise = function() {
	return this.divide(this.magnitude());
};

// Point
Layout.ForceDirected.Point = function(position, mass) {
	this.p = position; // position
	this.m = mass; // mass
	this.v = new Vector(0, 0, 0); // velocity
	this.a = new Vector(0, 0, 0); // acceleration
};

Layout.ForceDirected.Point.prototype.applyForce = function(force) {
	this.a = this.a.add(force.divide(this.m));
};

// Spring
Layout.ForceDirected.Spring = function(point1, point2, length, k) {
	this.point1 = point1;
	this.point2 = point2;
	this.length = length; // spring length at rest
	this.k = k; // spring constant (See Hooke's law) .. how stiff the spring is
};

// Layout.ForceDirected.Spring.prototype.distanceToPoint = function(point)
// {
// 	// hardcore vector arithmetic.. ohh yeah!
// 	// .. see http://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment/865080#865080
// 	var n = this.point2.p.subtract(this.point1.p).normalise().normal();
// 	var ac = point.p.subtract(this.point1.p);
// 	return Math.abs(ac.x * n.x + ac.y * n.y);
// };

var isEmpty = function(obj) {
	for (var k in obj) {
		if (obj.hasOwnProperty(k)) {
			return false;
		}
	}
	return true;
};
