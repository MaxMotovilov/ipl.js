// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var stream = require( 'stream' ),
	stream_utils = require( './stream_utils' ),
	promise = require( 'node-promise' );

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
		stack = _this.stack = [ is_script ? this.builders.ipl : this.builders.html ],
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
			append( body, stack[0].prolog( tagname, opener && opener.filename ) );

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
			append( body, stack[0].epilog() );

		return body;
	}
}

exports.parser = require( './parser' );

exports.expand = function( args, body ) {

	var _this = this;

	prepend( body, this.builders.build.prolog() );
	append( body, this.builders.build.epilog() );

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
			return segment.expand( _this, args );
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

	var _this = this,
		code = 'function() {\n' +
			body.map( function( segment ) {
				return typeof segment === 'function'
					? segment.apply( _this )
					: segment
				;
			} ).join( '\n' ) +
		'\n}';

	return this.dontRun ? code : evalInEnv( code )( args );
}

exports.rawInput = function( text ) {
	if( !/^\s*$/.test( text ) )
		append( this.body, this.stack[ 0 ].rawInput( text )	);
}

exports.substitution = function( text, alt_form ) {
	if( this.stack[0].substitution )
		append( this.body, this.stack[0].substitution( text, alt_form ) );
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
				append( body, top.epilog() );
			return;
		}
	} else if( !('fragmentIsScript' in this.stack[0] ) ) {
		throw Error( "@build@ script cannot contain tags" );
	}

	if( name in this.builders ) {
		if( args.length ) {
			if( 'fragmentIsScript' in this.builders[name] )
				append( body, namedFragment( args.shift(), this.builders[name].fragmentIsScript ) );
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
		append( body, namedFragment( name, stack[0].fragmentIsScript ) );
	}

	function openTag( builder ) {
		var latent_err = new Error( "Unterminated tag @" + name + "@" );
		latent_err.line = line;
		stack.unshift( delegate( builder, { openTagError: latent_err } ) );
		if( stack[0].prolog )
			append( body, stack[0].prolog( name ) );
	}

	function namedFragment( name, is_script ) {
		return new LoadFragment( name, is_script, args, line );
	}
}

function applicator( method ) {
	return function( to, what ) {
		if( !what )
			return;
		else if( what instanceof Array )
			method.apply( to, what );
		else
			method.call( to, what );
	}
}

var	append = applicator( Array.prototype.push ),
	prepend = applicator( Array.prototype.unshift );

exports.builders = {
	html: require( './html_builder' ),
	ipl: require( './ipl_builder' ),
	build: require( './build_builder' )
};

function LoadFragment( name, is_script, args, line ) {
	this.name = unwrap( name );
	this.isScript = is_script;
	this.args = args.map( unwrap );
	this.line = line;
}

LoadFragment.prototype = {
	expand: function( scope, args ) {
		return evalInEnv(
					'function() {\n' +
						'return this.loadFragment(' + this.name + ',' + this.isScript + ',[' + this.args.join(',') + ']);' +
					'\n}',
					scope.env
			   ).apply( scope, args );	
	}
}

function unwrap( arg ) {
	return typeof arg === 'string'
		? '"' + arg.replace( /\s+/g, ' ' ).replace( /["\\]/g, '\\&&' ) + '"'
		: arg.expr
	;
}

function evalInEnv( what, env ) {
	var keys = [], vals = [];

	for(var key in env) {
		keys.push( key );
		vals.push( env[key] );
	}

	return (new Function( keys, "return " + what )).apply( null, vals );
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
