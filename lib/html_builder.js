// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var ipl = require( './ipl_builder' ),
	build = require( './build_builder' );

exports.rawInput = function( text ) {
	return makeOutput( build.stringLiteral( htmlTrim( text ) ) );
}

exports.substitution = function( text, at_build_time ) {
	return [
		build.once( enc$html.toString() ),
		!at_build_time ? ipl.once( enc$html.toString() ) : "",
		makeOutput( "enc$html(" + text + ")", at_build_time )
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

function makeOutput( text, at_build_time ) {

	text = build.makeOutput( text );

	return build.atExpansion( function() {
		return !this._iplWrapped || at_build_time
			? text 
			: build.makeOutput( build.stringLiteral( text ) )
		;
	} );
}

function htmlTrim( s ) {
	return s.replace( /(?:[ \t]*\r?\n[ \t]*)+/g, '\n' ).replace( /[\t ]+/g, ' ' );
}

// === Injected code ===

function enc$html(s) {
	return s.toString().replace( /[<>'"&]/g, function(x) {
		return { "<": '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;', '&': '&amp;' }[x];
	} );
}
