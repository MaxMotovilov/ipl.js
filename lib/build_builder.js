// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var promise = require( 'node-promise' );

exports.rawInput = function( text ) {
	return text.replace( /^\s*$/mg, '' );
}
		
exports.prolog = function( tagname, file ) {
	var tryOpen = exports.tryOpen( tagname && tagname != "build" && ("build:" + tagname), file );

	return exports.atExpansion( function() {
		if( '_buildWrapped' in this ) {
			++this._buildWrapped;
			return tryOpen;
		} else {
			this._buildWrapped = 1;
			this._buildOnce = [ "var $=[];\n" ];
			return [ tryOpen, this._buildOnceResult = promise.defer() ];
		}
	} );
}

exports.epilog = function() {
	var tryClose = exports.tryClose();

	return exports.atExpansion( function() {
		if( --this._buildWrapped == 0 ) {
			this._buildOnceResult.resolve( this._buildOnce );
			// Avoid hitting this condition again from included fragments
			++this._buildWrapped;	
			return [ 
				"return $.join('');\n", 
				tryClose 
			];
		} else {
			return tryClose;
		}
	} );
}

exports.makeOutput = function( text ) {
	return '$.push(' + text + ');\n';
}

exports.tryOpen = function( tagname, file ) {
	return function() {
		if( !this._tryStack )
			this._tryStack = [];
		this._tryStack.push( [tagname,file] );
		return tagname && "try {\n" || "";
	}
}

exports.tryClose = function() {
	return function() {
		if( !this._tryStack || !this._tryStack.length )
			throw Error( "BUG - unbalanced try/catch scope" );
		
		return (function( tagname, file ) {
			return tagname && (
						"} catch( err ) {\n" +
						"if( !err.tagname ) {\n" +
						"err.tagname=" + exports.stringLiteral( tagname ) + ";\n" +
				   		( file && ("err.filename=" + exports.stringLiteral( file ) + ";\n") || "" ) +
						"}\n" +
						"throw err;\n" + "}\n"
				   ) || "";
		}).apply( this, this._tryStack.pop() );
	}
}

exports.stringLiteral = function( text ) {
	return '"' + text.replace( /["\\]/g, "\\$&" )
					 .replace( /[\n\t\r\v]/g, function(c) { return { '\n': "\\n", '\t': "\\t", '\r': "\\r", '\v': "\\v" }[c]; } ) 
		 + '"';
}

exports.type = "build";

// FIXME: O(N^2)
function addOnce( fragment ) {
	return function() {
		if( this._buildOnce.indexOf( fragment ) < 0 )
			this._buildOnce.unshift( fragment );
		return "";
	}
}

exports.once = function( fn ) {
	if( typeof fn === 'function' ) {
		if( !fn.name )
			throw Error( "BUG - build.once() expects a string or a named function" );

		return function() {
			if( !(fn.name in this.env ) )
				this.env[fn.name] = fn;
			return "";
		}
	} else {
		return exports.atExpansion( addOnce( fn ) );
	}
}

exports.once.type = "build";

exports.once.prolog = function() {
	return exports.atExpansion( function() {
		this._buildOnce.push( "" );
		return "";
	} );
}

exports.once.epilog = function() {
	return exports.atExpansion( function() {
		return addOnce( this._buildOnce.pop() ).call( this );
	} );
}

exports.once.rawInput = function( text ) {
	if( typeof text !== 'string' )
		throw Error( "BUG - unexpanded content in @build@" );
	return exports.atExpansion( function() {
		this._buildOnce[this._buildOnce.length-1] += text;
		return "";
	} );
}

exports.subScopes = { once: exports.once } 

exports.atExpansion = function( metasegment ) {
	return {
		expand: function( scope ) {
			return metasegment.call( scope );
		}
	}
}

