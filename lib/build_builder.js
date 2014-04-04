// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var promise = require( 'node-promise' );

exports.rawInput = function( text ) {
	return text;
}
		
exports.prolog = function() {
	return atExpansion( function() {
		if( '_buildWrapped' in this ) {
			++this._buildWrapped;
			return "";
		} else {
			this._buildWrapped = 1;
			this._buildOnce = [ "var $=[];\n" ];
			return this._buildOnceResult = promise.defer();
		}
	} );
}

exports.epilog = function() {
	return atExpansion( function() {
		if( --this._buildWrapped == 0 ) {
			this._buildOnceResult.resolve( this._buildOnce );
			return "return $.join('');\n";
		} else {
			return "";
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
						"err.tagname=" + exports.stringLiteral( tagname ) + ";\n" +
				   		( file && ("err.filename=" + exports.stringLiteral( file ) + ";\n") || "" ) +
				   		"}\n"
				   ) || "";
		}).apply( this, this._tryStack.pop() );
	}
}

exports.stringLiteral = function( text ) {
	return '"' + text.replace( /["\\]/g, "\\&&" )
					 .replace( /[\n\t\r\v]/g, function(c) { return { '\n': "\\n", '\t': "\\t", '\r': "\\r", '\v': "\\v" }[c]; } ) 
		 + '"';
}

exports.once = function( fragment ) {
	// FIXME: O(N^2)
	return function( fragment ) {
		if( this._buildOnce.indexOf( fragment ) < 0 )
			this._buildOnce.push( fragment );
		return "";
	}
}

exports.once.prolog = function() {
	return function() {
		this._buildOnce.push( "" );
		return "";
	}	
}

exports.once.epilog = function() {
	return function() {
		return exports.once.call( this, this._buildOnce.pop() );
	}
}

exports.once.rawInput = function( text ) {
	if( typeof text !== 'string' )
		throw Error( "BUG - unexpanded content in @build@" );
	return function() {
		this._buildOnce[this._buildOnce.length-1] += text;
	}
}

exports.subScopes = { once: exports.once } 

function atExpansion( metasegment ) {
	return {
		expand: function( scope ) {
			return metasegment.call( scope );
		}
	}
}
