// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var fs = require( 'fs' ),
	stream = require( 'stream' ),
	path = require( 'path' );

module.exports.select = function( openers, arg ) {
	
	var result = new stream.PassThrough(),
		i = 0;

	next();
	return result;

	function next() {
		var s;

		do {
			if( i==openers.length )
				result.emit( 'error', new Error( 'Cannot satisfy include("' + arg.toString() + '")' ) );
		} while( !( s = openers[i++]( arg ) ) );

		s.once( 'error', next );
		s.once( 'readable', pipe );

		function pipe() {
			s.removeListener( 'error', next );
			s.pipe( result );
		}
	}
}

module.exports.opener = function( path ) {
	return function( filename ) {
		return fs.createReadStream( path.join( path, filename ) );
	}
}

