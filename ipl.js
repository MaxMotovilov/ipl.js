// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var path = require( 'path' ),
	stream = require( './lib/stream_utils' );

function IPL( config ) {
	if( !(this instanceof IPL) )
		return new IPL( config );

	var include = config.include;

	if( !include ) {
		this.include = stream.opener( path.join( __dirname, 'include' ) );
	} else {
		include = [].concat( include, path.join( __dirname, 'include' ) );
		
		this.include = function( what ) {
			var o = include.map( function( x ) {
				return typeof x === 'function' ? x.bind( null, what ) : stream.opener( path.join( x, what ) );
			} );
			return o.reduce( stream.select.bind( stream ), o.shift()() );
		}
	}

	if( config.env )
		this.env = config.env;

	this.cache = {};
}

IPL.prototype = require( './lib/prototype' );

module.exports = IPL;

