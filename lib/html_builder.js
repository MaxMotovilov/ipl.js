// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var ipl = require( './ipl_builder' ),
	build = require( './build_builder' );

exports.rawInput = function( text ) {

	text = build.makeOutput( build.stringLiteral( htmlTrim( text ) ) );

	return build.atExpansion( function() {
		return this._iplWrapped 
			? build.makeOutput( build.stringLiteral( text.replace( /<\/\s*script\s*>/ig, '<\\/script>' ) ) ) 
			: text
		;
	} );
}

exports.substitution = function( text, at_build_time ) {
	return [
		at_build_time ? build.once( to$string ) : "",
		makeOutput( text, at_build_time )
	];
}

exports.prolog = function( tagname, file ) {
	return build.tryOpen( tagname && tagname != "html" && ("html:" + tagname), file );
}

exports.epilog = function() {
	return build.tryClose();
}

exports.defaultSubScope = "ipl";
exports.type = "html";
exports.subScopes = {} 

function makeOutput( text, build_time ) {
	return build.atExpansion( function() {
		return build.makeOutput(
			this._iplWrapped
				? build_time 
					? '"$.push("+to$string(' + text + ')+");\\n"' 
					: build.stringLiteral( build.makeOutput( text ) )
				: text
		);
	} );
}

function htmlTrim( s ) {
	return s.replace( /(?:[ \t]*\r?\n[ \t]*)+/g, '\n' ).replace( /[\t ]+/g, ' ' );
}

// === Injected code ===

function to$string( s ) {
	return '"' + s.toString().replace( /["\\]/g, "\\$&" )
					 		 .replace( /[\n\t\r\v]/g, function(c) { return { '\n': "\\n", '\t': "\\t", '\r': "\\r", '\v': "\\v" }[c]; } ) 
		 + '"';
}
