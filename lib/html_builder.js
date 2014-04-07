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

	text = "enc$html(" + text + ")";

	return [
		( at_build_time ? build.once : ipl.once )( enc$html.toString() ),
		at_build_time ? build.makeOutput( text ) : makeOutput( text )
	];
}

exports.prolog = function( tagname, file ) {
	return build.tryOpen( tagname && tagname != "html" && ("html:" + tagname), file );
}

exports.epilog = function() {
	return build.tryClose();
}

exports.defaultSubScope = "ipl";
exports.fragmentIsScript = false;
exports.subScopes = {} 

function makeOutput( text ) {

	text = build.makeOutput( text );

	return function() {
		if( !this._ipl )
			return text;
		else
			return build.makeOutput( build.stringLiteral( text ) );
	}
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
