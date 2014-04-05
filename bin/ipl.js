// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var ipl = require( '../ipl' );

if( process.argv.length < 3 ) {
	process.stderr.write( 
		process.argv.join( ' ' ) + 
		" [--include[=]Path[,Path...]] [--dontRun] [--Name[.Name...][=]Value...] [<]Input [Arg...] [>Output]\n"
	);
	process.exit( 1 );
}

var	config = {}, env = {}, input, args = [],
	rest = process.argv.slice(2).reduce( function( prior, arg ) {
		var s;

		if( prior )	
			addArg( prior, arg );
		else if( s = /^--([^=]+)(?:=(.*))?$/.exec( arg ) ) {
			return addArg( s[1], s[2] );
		} else {
			if( input )
				args.push( parseValue( arg ) );
			else
				input = arg;
		}

		return null;
		
	}, null );

if( rest ) {
	process.stderr.write( process.argv.join( ' ' ) + ': --' + rest + ' is missing its value' );
	process.exit( 1 );
}

ipl( config, input || process.stdin, env, input && /[.]js$/.test( input ), args )
	.on( 'error', function( err ) {
		console.log( 
			(err.tagname && (
				err.tagname +
				(err.filename && (
					" (" + err.filename +
					(err.line ? ' [' + err.line + ']' : "") +
					")"
				) || "") + ": "
			) || "") +
			err.stack
		);
		process.exit( 1 );
	} )
	.pipe( process.stdout );

function addArg( name, value ) {
	if( name == 'dontRun' )
		config.dontRun = true;
	else if( value == null )
		return name;
	else if( name == 'include' )
		config.include = (config.include || []).concat( value.split(',') );
	else {
		var path = name.split('.');
		path.slice(0,path.length-1)
		    .reduce( function( obj, f ) {
				return obj[f] || ( obj[f] = {} );
			}, env )[path[path.length-1]] 
		= parseValue( value );
	}
	return null;
}

function parseValue( s ) {
	var v = parseFloat( s );
	if( !Number.isNaN(v) ) return v;

	if( s == "true" )	return true;
	if( s == "false" )	return false;
	if( s == "null" )	return null;

	if( /^\[.*\]$/.test( s ) )
		return s.substring( 1, s.length-1 ).split( ',' ).map( parseValue );

	return s;
}
