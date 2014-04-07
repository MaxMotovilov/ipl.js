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
	_this.isScript = is_script || false;

	_this.precompile( input, is_script )
		 .then( function( body ) {
			prepend( body, exports.builders.build.prolog() );
			append( body, exports.builders.build.epilog() );
			return body;
		 } )
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
			return stream_utils.readAll( opener = _this.include( input + (is_script ? ".js" : ".html") ), _this.encoding );
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

	var _this = this, any;

	return whilst(
		function( body ) {
			return body.some( function( x ) { return typeof x === 'object'; } );
		},
		function( body ) {
			return promise.allOrNone( body.map( expandOne ) )
						  .then( function( expanded ) {
							return expanded.reduce( flatten, [] );
						  } );
		}
	)( body.reduce( flatten, [] ) );

	function expandOne( segment ) {
		if( typeof segment === 'object' )
			try {
				return segment.expand( _this, args );
			} catch( err ) {
				if( segment.line )
					err.line = segment.line;
				throw err;
			}
		else
			return segment;
	}
}

function whilst( pred, body ) {
	return function loop( v ) {
		return promise.when( pred( v ), guarded );

		function guarded( cond ) {
			return cond ? body ? promise.when( body( v ), loop ) : loop( cond ) : v;
		}
	}
}

function flatten( output, segment ) {
	if( segment instanceof Array )
		output.push.apply( output, segment.reduce( flatten, [] ) );
	else
		output.push( segment );
	return output;
}

exports.loadFragment = function( name, is_script, expand_args, build_args ) {
	var cache = this.cache[ is_script ? "ipl" : "html" ],
		result = promise.when(
			cache[name] || (cache[name] = this.precompile( name, is_script )),
			function( precompiled ) {
				return cache[name] = precompiled;
			}
		).then( this.expand.bind( this, expand_args ) );

	return build_args.length
		? result.then( function( expanded ) {
			expanded.unshift( "(function(){\n" );
			expanded.push( "})(" + build_args.join(',') + ");\n" );
			return expanded;
		} )
		: result
	;
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

	return this.dontRun ? code : evalInEnv( code, this.env )( args );
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

exports.emptyTag = function( long, line ) {
	var stack = this.stack, body = this.body,
		in_build = !('fragmentIsScript' in stack[0] );

	if( long ? in_build : stack.length > 1 ) {
		if( !long && in_build )
			throw Error( "@@@ block cannot be terminated by @@" );
		var top = stack.shift();
		if( top.epilog )
			append( body, top.epilog() );
	} else {
		var name = long ? "build" : stack[0].defaultSubScope;
		if( !name )
			throw Error( "BUG - cannot determine type of @@ block" );
		this.openBlock( "", this.builders[name], line );
	}
}

exports.tag = function( name, args, line ) {

	var stack = this.stack, body = this.body;

	if( !('fragmentIsScript' in stack[0] ) )
		throw Error( "@build@ script cannot contain tags" );

	if( name in stack[0].subScopes ) {
		openTag( stack[0].subScope[name] );
	} else if( name in this.builders ) {
		if( args.length ) {
			if( 'fragmentIsScript' in this.builders[name] )
				append( body, namedFragment( args.shift(), this.builders[name].fragmentIsScript ) );
			else
				throw Error( name + ": is not a recognized fragment type" );
		} else {
			if( this.builders[name] === this.stack[0] )
				throw Error( "Redundant @" + name + "@ tag is not allowed" );
			this.openBlock( name, this.builders[name], line );
		}
	} else {
		append( body, namedFragment( name, stack[0].fragmentIsScript ) );
	}

	function namedFragment( name, is_script ) {
		return new exports.LoadFragment( name, is_script, args, line );
	}
}

exports.openBlock = function( name, builder, line ) {
	var latent_err = new Error( "Unterminated tag @" + name + "@" );
	latent_err.line = line;
	this.stack.unshift( delegate( builder, { openTagError: latent_err } ) );
	if( this.stack[0].prolog )
		append( this.body, this.stack[0].prolog( name ) );
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

exports.LoadFragment = function( name, is_script, args, line ) {
	this.name = unwrap( name );
	this.isScript = is_script;
	this.args = args.map( unwrap );
	this.line = line;
}

exports.LoadFragment.prototype = {
	expand: function( scope, args ) {
		return evalInEnv(
					'function() {\n' +
						'return this.loadFragment(' + this.name + ',' + this.isScript + ',[' + this.args.join(',') + '],$arguments);' +
					'\n}',
					scope.env, ['$arguments'], [this.args]
			   ).apply( scope, args );	
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

function evalInEnv( what, env, keys, vals ) {
	keys = keys || [];
	vals = vals || [];

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
