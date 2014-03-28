// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var stream = require( 'stream' ),
	stream_utils = require( './stream_utils' );

exports.generate = function( input, env, is_script, args ) {

	var result = new stream.PassThrough(), 
		_this = Object.create( this ),
		expanded;

	_this.env = delegate( _this.env, env );
	_this.sharedScope = _this;

	_this.precompile( input, is_script )
		 .then( _this.expand.bind( _this, args ) )
		 .then( _this.run.bind( _this, args ) )
		 .then( 
			function( output ) {
				result.write( output, this.encoding );
				result.end();
				delete _this.sharedScope;
			},
			function( err ) {
				result.emit( 'error', err );
				delete _this.sharedScope;
			}
		 );
	
	return result;
}

exports.precompile = function( input, is_script ) {

	var _this = Object.create( this.sharedScope ),
		stack = _this.stack = [ is_script ? this.builders.ipl, this.builders.html ],
		body = _this.body = [],
		opener, tagname;

	return promise.when( load(), parse );

	function load() {
		if( input instanceof stream.Readable )
			return stream_utils.readAll( opener = input, _this.encoding );
		else if( input.indexOf( '@' ) >= 0 )
			return input;
		else if( './'.indexOf( input.charAt(0) ) >= 0 )
			return stream_utils.readAll( opener = stream_utils.opener( input + (is_script ? ".js" : ".html") )(), _this.encoding );
		else {
			tagname = input;
			return stream_utils.readAll( opener = this.include( input + (is_script ? ".js" : ".html") ), _this.encoding );
		}
	}

	function parse( text ) {
		if( stack[0].prolog )
			body.push( stack[0].prolog( tagname, opener && opener.filename ) );

		try {
			_this.parser( text );
			if( stack.length != 1 )
				throw stack[0].openTagError;
		} catch( err ) {
			if( opener && opener.filename )
				err.filename = opener.filename;
			if( tagname )
				err.tagname = tagname;
			throw err;
		}

		if( stack[0].epilog )
			body.push( stack[0].epilog() );
	}
}

exports.parser = require( './parser' );

exports.expand = function( args, body ) {

	var _this = this;

	return promise.allOrNone( body.map( expandOne ) )
				  .then( function( expanded ) {
					return expanded.reduce( 
						function( output, segment ) {
							if( segment instanceof Array )
								output.push.apply( output, segment );
							else
								output.push( segment );
							return output;
						}, []
					);
				  } );

	function expandOne( segment ) {
		if( typeof segment === 'function' || typeof segment === 'string' )
			return segment;

		try {
			return evalInEnv(
					'function() {\n' +
						'return this.loadFragment(' + segment.name + ',' + segment.isScript + ',[' + segment.args.join(',') + ']);' +
					'\n}',
					_this.env
				   ).apply( _this, args );
		} catch( err ) {
			if( segment.line )
				err.line = segment.line;
			throw err;
		}
	}
}

exports.loadFragment = function( name, is_script, args ) {
	var cache = this.cache[ is_script ? "ipl" : "html" ];

	return promise.when(
				cache[name] || (cache[name] = this.precompile( name, is_script )),
				function( precompiled ) {
					return cache[name] = precompiled;
				}
		   ).then( this.expand.bind( this, args ) );
}

exports.run = function( args, body ) {
	var _this = this;
	return evalInEnv(
		'function() {\n' +
			body.map( function( segment ) {
				return typeof segment === 'function'
					? segment.apply( _this )
					: segment
				;
			} ).join( '\n' ) +
		'\n}'
	)( args );
}

exports.rawInput = function( text ) {
	this.body.push(
		this.stack[ 0 ].rawInput( text )
	);
}

exports.substitution = function( text, alt_form ) {
	if( this.stack[0].substitution )
		this.body.push( this.stack[0].substitution( text, alt_form ) );
	else
		throw Error( "@build@ script cannot contain substitutions" );
}

exports.argSubstitution = function( text ) {
	return { expr: text };
}

exports.tag = function( name, args, line ) {

	var stack = this.stack, body = this.body;

	if( !name ) {
		if( args.length )	
			throw Error( "Tag with arguments must have a name" );

		if( stack.length > 1 || !(name = stack[0].defaultSubScope) ) {
			var top = stack.shift();
			if( top.epilog )
				body.push( top.epilog() );
			return;
		}
	} else if( !('fragmentIsScript' in this.stack[0] ) ) {
		throw Error( "@build@ script cannot contain tags" );
	}

	if( name in this.builders ) {
		if( args.length ) {
			if( 'fragmentIsScript' in this.builders[name] )
				body.push( namedFragment( args.shift(), this.builders[name].fragmentIsScript, args ) );
			else
				throw Error( name + ": is not a recognized fragment type" );
		} else {
			if( this.builders[name] === this.stack[0] )
				throw Error( "Redundant @" + name + "@ tag is not allowed" );
			openTag( this.builders[name] );
		}
	} else if( name in stack[0].subScopes ) {
		openTag( stack[0].subScope[name] );
	} else {
		body.push( namedFragment( name, stack[0].fragmentIsScript, args ) );
	}

	function openTag( builder ) {
		var latent_err = new Error( "Unterminated tag @" + name "@" );
		latent_err.line = line;
		stack.unshift( delegate( builder, { openTagError: latent_err } ) );
		if( stack[0].prolog )
			body.push( stack[0].prolog( name ) );
	}
}

function namedFragment( name, is_script, args ) {
	return {
		name: unwrap( name ),
		isScript: is_script,
		args: args.map( unwrap )
	}
}

function unwrap( arg ) {
	return typeof arg === 'string'
		? '"' + arg.replace( /\s+/g, ' ' ).replace( /["\\]/g, '\\&&' ) + '"'
		: arg.expr
	;
}

exports.builders = {
	html: require( './html_builder' ),
	ipl: require( './ipl_builder' ),
	build: require( './build_builder' )
};

function evalInEnv( what, env ) {
	var keys = [], vals = [];

	for(var key in env) {
		keys.push( key );
		vals.push( env[key] );
	}

	return (new Function( keys, "return " + what )).apply( null, vals );
}

function addMixin( clazz ) {
	return function() {
		var proto = delegate( this, clazz.prototype ),
			instance = Object.create( proto );

		clazz.apply( instance );

		return instance;	
	}
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

function identity(x){ return x; }
