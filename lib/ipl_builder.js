// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var	build = require( './build_builder' );

exports.rawInput = makeOutput;
		
exports.substitution = function( text, as_is ) {
	return as_is 
		? build.makeOutput( text )
		: [
			build.once( to$Literal.toString() ),
			build.makeOutput( "to$Literal(" + text + ")" )
		]
	;
}

exports.prolog = function( tagname, file ) {

	var tryOpen = build.tryOpen( tagname && tagname != "ipl" && ("ipl:" + tagname), file ),
		once = "var $once=[], pos$once=$.length;\n";

	return build.atExpansion( function() {
		if( '_iplWrapped' in this ) {
			++this._iplWrapped;
			return tryOpen;
		} else {

			var maybe_fail = !tagname && 'throw Error( "@@ encountered outside of @ipl@ block" );\n' || '';

			this._iplWrapped = 1;

			return this.isScript
				? [ this.builtinFragment( "ipl$prolog", "ipl" ), 
					once, maybe_fail, tryOpen ]
				: [ this.builtinFragment( "ipl$prolog", "html" ), 
					this.builtinFragment( "ipl$prolog", "ipl" ), 
					"var $once=[], pos$once=$.length;\n",
					once, maybe_fail, tryOpen ]
			;
		}
	} );
}

exports.epilog = function() {
	
	var tryClose = build.tryClose(),
		once = 	"$once.unshift( pos$once, 0 );\n" +
			   	"$.splice.apply($,$once);\n";

	return build.atExpansion( function() {
		if( --this._iplWrapped == 0 ) {

			// Avoid hitting this condition again from included fragments
			++this._iplWrapped;	

			return this.isScript 
				? [ tryClose, once,
					this.builtinFragment( "ipl$epilog", "ipl" ) ]
				: [ tryClose, once,
					this.builtinFragment( "ipl$epilog", "ipl" ),
					this.builtinFragment( "ipl$epilog", "html" ) ]
			;
		} else {
			return tryClose;
		}
	} );
}

exports.defaultSubScope = "html";
exports.type = "ipl";

exports.once = function( fragment ) {
	return [
		build.atExpansion( function() { 
			return this._iplWrapped ? "" :
				'throw Error( "@= used outside of an @ipl@ block" );\n';
		} ),
		build.once( add$once.toString() ),
		"add$once(" + build.stringLiteral( fragment ) + ");\n"
	];
}

exports.once.type = "ipl";

exports.once.prolog = function() {
	return '$once.push("");\n';
}

exports.once.epilog = function() {
	return [
		build.once( add$once.toString() ),
		"add$once($once.pop());\n"
	];
}

exports.once.rawInput = function( text ) {
	return appendToOnce( build.stringLiteral( text ) );
}

exports.once.substitution = function( text, as_is ) {
	return as_is 
		? appendToOnce( text )
		: [
			build.once( to$Literal.toString() ),
			appendToOnce( "to$Literal(" + text + ")" )
		]
	;	
}

function appendToOnce( text ) {
	return "$once[$once.length-1]+=" + text + ";\n";
}

exports.subScopes = { once: exports.once } 

function makeOutput( text ) {
	return build.makeOutput( build.stringLiteral( text ) );
}

// === Injected code ===

function to$Literal( v ) {
	return typeof v === 'string' ? 
			str(v)
		 : typeof v === 'number' || typeof v === 'boolean' || typeof v === 'function' || v instanceof RegExp ?
			v.toString()
		 : typeof v === 'undefined' ?
			"undefined"
		 : v === null ?
			"null"
		 : v instanceof Array ?
			"[" + v.map( to$Literal ).join(",") + "]"
		 : // typeof v === 'object' ?
			'{' + Object.keys(v).map( function(k){ return str(k) + ":" + to$Literal(v[k]); } ).join(",") + "}"
	;

	function str(v) {
		return '"' + v.replace( /["\\]/g, "\\$&" ) + '"';
	}
}

// FIXME: O(N^2)
function add$once( t ) {
	if( $once.indexOf( t ) < 0 )
		$once.push( t );
}

