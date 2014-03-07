//////////////////////////////////////////////////////////////////////////////
/**
 * @module vgl
 */

/*jslint devel: true, forin: true, newcap: true, plusplus: true*/
/*jslint white: true, continue:true, indent: 2*/

/*global vgl, ogs, vec4, inherit, window, $*/
//////////////////////////////////////////////////////////////////////////////

if(typeof ogs === 'undefined') {
  var ogs = {};
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Create namespace for the given name
 *
 * @param ns_string
 * @returns {*|{}}
 */
//////////////////////////////////////////////////////////////////////////////
ogs.namespace = function(ns_string) {
  'use strict';

  var parts = ns_string.split('.'), parent = ogs, i;

  // strip redundant leading global
  if (parts[0] === "ogs") {
    parts = parts.slice(1);
  }
  for (i = 0; i < parts.length; i += 1) {
    // create a property if it doesn't exist
    if (typeof parent[parts[i]] === "undefined") {
      parent[parts[i]] = {};
    }
    parent = parent[parts[i]];
  }
  return parent;
};

/** vgl namespace */
var vgl = ogs.namespace("gl");

//////////////////////////////////////////////////////////////////////////////
/**
 * Convenient function to define JS inheritance
 *
 * @param C
 * @param P
 */
//////////////////////////////////////////////////////////////////////////////
function inherit(C, P) {
  "use strict";

  var F = function() {
  };
  F.prototype = P.prototype;
  C.prototype = new F();
  C.uber = P.prototype;
  C.prototype.constructor = C;
}

//////////////////////////////////////////////////////////////////////////////
/**
 * Convenient function to get size of an object
 *
 * @param obj
 * @returns {number} *
 */
//////////////////////////////////////////////////////////////////////////////
Object.size = function(obj) {
  "use strict";

  var size = 0, key = null;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      size++;
    }
  }
  return size;
};

//////////////////////////////////////////////////////////////////////////////
/**
 * Create a requirejs `define` shim if it is not loaded
 *
 * @param {string} name
 * @param {Array} deps
 * @param {Function} moduleLoader
 * 
 */
//////////////////////////////////////////////////////////////////////////////
if (window && window.define === undefined) {
    window.define = function (name, deps, moduleLoader) {
        var nmList = name.split('.'),
            baseName = nmList.pop(),
            nmSpace = ogs.namespace(nmList.join('.')),
            depObjs = [];
        
        // pack dependencies into an array
        deps.forEach(function (dep) {
            var depObj = ogs.namespace(dep);
            depObjs.push(depObj);
        });
        
        // call moduleLoader with dependencies objects
        nmSpace[baseName] = moduleLoader.apply(this, depObjs);
    };
}

