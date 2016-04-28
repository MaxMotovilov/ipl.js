var fs = require( 'fs' ),
	path = require( 'path' );

module.exports = 
	fs.readdirSync( path.join( __dirname, "env" ) )
	  .filter( function( f ) { return /\.js$/.test( f ); } )
      .map( function( f ) { return f.replace( /\.js$/, "" ); } )
      .reduce( function( modules, file ) {
		  modules[file] = require( "./env/" + file );
		  return modules;
      }, {} )
;

