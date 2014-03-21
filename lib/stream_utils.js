// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var fs = require( 'fs' ),
	stream = require( 'stream' );

module.exports.select = function( first, second ) {
	
	if( !first ) {
		return second();
	} else if( first instanceof PassThrough ) {
		
		return next( first );
	} else  else {
		return next
	}

			first = new stream.PassThrough();
		
		
	first.
}
