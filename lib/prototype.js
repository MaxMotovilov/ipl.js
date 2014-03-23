// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var stream = require( 'stream' ),
	fs = require( 'fs' ),
	promise = require( 'node-promise' );

module.exports.generate = function( input, env, is_script, args ) {

	var result = new stream.PassThrough(), 
		_this = Object.create( this );

	_this.self = _this;
	_this.inProgress = [];

	var compiled = _this.compile( input, is_script );

	promise.allOrNone( _this.inProgress )
		   .then( function() {
				result.write( compiled.run( delegate( _this.env, env ), args ), 'utf8' );
				result.end();
				delete _this.self;
			} );
	
	return result;
}

module.exports.compile = function( input, is_script ) {

	var _this = is_script ? this.iplBuilder() : this.htmlBuilder(),

		result = promise.when(
			_this.load( input ),
			_this.parser.bind( _this ) 
		).then( _this.build.bind( _this ) );

	this.inProgress.push( result );

	return result;
}

module.exports.parser = require( './parser' );

module.exports.iplBuilder = addMixin( require( './ipl_builder' ) );

module.exports.htmlBuilder = addMixin( require( './html_builder' ) );

module.exports.load = function( input ) {
	if( input instanceof stream.Readable )
		return readAll( input );
	else if( input.indexOf( '@' ) >= 0 )
		return input;
	else if( './'.indexOf( input.charAt(0) ) >= 0 )
		return readAll( fs.createReadStream( input ) );
	else
		return readAll( this.include( input ) );
}

module.exports.tag = function( name, args ) {
	
}

function addMixin( clazz ) {
	var proto = delegate( this, clazz.prototype ),
		instance = Object.create( proto );

	clazz.apply( instance );

	return instance;	
}

function delegate( proto, props ) {
	if( !proto )
		return props ? copyAllProperties( {}, props ) : {};
	var v = Object.create( proto );
	return props ? copyAllProperties( v, props ) : v;
}

function copyAllProperties( to, from ) {
	for( var i in from )
		to[i] = from[i];
	return to;
}

function readAll( input ) {
	
}
