var promise = require( 'node-promise' );

exports.returnLater = function( what ) {
	return promise.delay( 500 ).then( function() { return what; } );
}

exports.failLater = function() {
	return promise.delay( 500 ).then( function() { throw Error( "Failed!" ); } );
}

