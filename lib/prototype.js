// Copyright (C) 2014-2016, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

var stream = require( 'stream' ),
	stream_utils = require( './stream_utils' ),
	promise = require( 'node-promise' ),
	beautify, uglify;

function beautifier( verb ) {
	return verb && (
				verb == "beautify" && (beautify = beautify || require('js-beautify').js_beautify)
			 || verb == "minify" && (uglify = uglify || adapt( require('uglify-js').minify ))
		   ) || identity
	;

	function identity( text ) { return text; }

	function adapt( minify ) {
		return function( text ) {
			return minify( text, { fromString: true, output: { inline_script: true, comments: /.*<!--#.*/ } } ).code;
		}
	}
}

function identity(x) {
	return x;
}

function pragma( what ) {
	if( {beautify:1, minify:1}[what] )
		this.$ipl.beautify = beautifier( what );
}

function whenAll( promises, body, err_metadata ) {
	var result = 
			promise.allOrNone( promises )
				   .then( function( results ) {
						return body.apply( this, results );
				    } )
			;

	if( err_metadata.length )
		return result.then(
			identity,
			function(err) {
				if( !err.tagname ) {
					err.tagname = err_metadata[0];
					if( err_metadata[1] )
						err.filename = err_metadata[1];
				}
				throw err;
			}
		);
	else
		return result;
}

function finalRender( result /*, ... */ ) {

	var result = resolveCompletely( result, identity, flattenStrings );

	for( var i=1; i<arguments.length; ++i )
		result = promise.when( result, arguments[i] );

	return promise.when(
		result,
		function( array ) { return array.join( "" ); } 
	);
}

exports.generate = function( input, env, is_script, args ) {

	var result = new stream.PassThrough(), 
		_this = Object.create( this ),
		expanded;

	_this.env = delegate( this.env, env );
	_this.env.require = require;
	_this.env.pragma = pragma.bind( _this.env );
	_this.env.$ipl = { beautify: beautifier(), when: whenAll, render: finalRender };

	_this.sharedScope = _this;
	_this.isScript = is_script || false;

	_this.precompile( input, is_script ? "ipl" : "html" )
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

var extensions = { html: ".html", ipl: ".js", build: ".build.js" };

exports.precompile = function( input, fragment_type ) {

	var _this = Object.create( this.sharedScope ),
		stack = _this.stack = [ this.builders[fragment_type] ],
		body = _this.body = [],
		opener, tagname;

	return promise.when( load(), parse );

	function load() {
		if( input instanceof stream.Readable )
			return stream_utils.readAll( opener = input, _this.encoding );
		else if( input.indexOf( '@' ) >= 0 )
			return input;
		else if( './'.indexOf( input.charAt(0) ) >= 0 )
			return stream_utils.readAll( opener = stream_utils.select( [stream_utils.opener("")], input + extensions[fragment_type] ), _this.encoding );
		else {
			tagname = input;
			return stream_utils.readAll( opener = _this.include( input + extensions[fragment_type] ), _this.encoding );
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

	return resolveCompletely( body, function( body ) { return body.map( expandOne ) }, flatten );

	function expandOne( segment ) {
		if( segment && segment.expand )
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

function resolveCompletely( what, resolve, flatten ) {
	return whilst(
		function( body ) {
			return body.some( function( x ) { return typeof x === 'object'; } );
		},
		function( body ) {
			return promise.allOrNone( resolve( body ) )
						  .then( function( expanded ) {
							return expanded.reduce( flatten, [] );
						  } );
		}
	)( what.reduce( flatten, [] ) );
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
	else if( segment )
		output.push( segment );
	return output;
}

function flattenStrings( output, segment ) {
	if( segment instanceof Array )
		output.push.apply( output, segment.reduce( flattenStrings, [] ) );
	else if( typeof segment === 'string' || segment && segment.then )
		output.push( segment );
	else
		output.push( String(segment) );
	return output;
}

exports.loadFragment = function( name, type, expand_args, build_args ) {

	var _this = this, 
		ipl_wrapped = this._iplWrapped,
		cache = this.cache[ type ],
		promises;

	return 	promise.whenPromise(
				cache[name] || (cache[name] = this.precompile( name, type )),
				function( precompiled ) {
					return cache[name] = precompiled;
				}
			).then( function( fragment ) {
				var wrap = !_this._iplWrapped && ipl_wrapped;
				if( wrap )	_this._iplWrapped = ipl_wrapped;
				promises = fragment.promises;
				var v = _this.expand( expand_args, fragment );
				if( wrap )	delete _this._iplWrapped;
				return v;
			} ).then( function( expanded ) {

				if( build_args.length && expanded.length ) {
					expanded.unshift( "(function(){\n" );
					expanded.push( "})(" + build_args.join(',') + ");\n" );
				}

				if( promises ) {
					expanded.unshift( 
						"$.push($ipl.when([" + promises.map( 
							function(kv){ return kv.value; } 
						).join( "," ) + "],",
							"function(" + promises.map( 
								function(kv){ return kv.name; } 
							).join( "," ) + "){\n",
								"var $=[];\n"
					);
					expanded.push( 
								"return $\n",
							"},",
							function() { return JSON.stringify( promises.errMetadata ); },
						"));"
					);
				}
	
				return expanded;
			} )
	;
}

exports.run = function( args, body ) {

	var code = 'function() {\n' +
			body.map( function( segment ) {
				return typeof segment === 'function'
					? segment.apply( this )
					: segment
				;
			}, this ).join( '' ) +
		'\n}',
		result = this.dontRun ? code : evalInEnv( code, this.env )( args )
	
	return this.dontRun  ? beautifier( "beautify" )( result )
		 : this.isScript ? this.env.$ipl.beautify( result ) 
		 : result
	;
}

exports.rawInput = function( text ) {
	if( !/^\s*$/.test( text ) )
		append( this.body, this.stack[ 0 ].rawInput( text )	);
}

exports.substitution = function( text, long_form ) {
	if( this.stack[0].substitution )
		append( this.body, this.stack[0].substitution( text, long_form ) );
	else
		throw Error( "@@@ block cannot contain substitutions" );
}

exports.argSubstitution = function( text ) {
	return { expr: text };
}

exports.emptyTag = function( long, line ) {
	var stack = this.stack, body = this.body,
		in_build = stack[0].type == "build";

	if( long && in_build && !stack[0].longTag )
		throw Error( "@@@ block cannot be terminated by @@" );

	if( long ? in_build : stack.length > 1 ) {
		var top = stack.shift();
		if( top.epilog )
			append( body, top.epilog() );
	} else {
		var name = long ? "build" : stack[0].defaultSubScope;
		if( !name )
			throw Error( "BUG - cannot determine type of @@ block" );
		this.openBlock( "", this.builders[name], line );
		if( long )	
			this.stack[0].longTag = true;
	}
}

exports.tag = function( name, args, line ) {

	var stack = this.stack, body = this.body, env = this.env;

	if( name in { global: 1, promise: 1 } ) {

		append( body, exports.builders.build[ name ].apply( this, args ) );

	} else if( name in stack[0].subScopes ) {

		this.openBlock( name, stack[0].subScopes[name], line );

	} else if( name in this.builders ) {

		if( args.length ) {
			append( body, namedFragment( args.shift(), this.builders[name].type ) );
		} else {
			if( this.builders[name] === this.stack[0] )
				throw Error( "Redundant @" + name + "@ tag is not allowed" );
			this.openBlock( name, this.builders[name], line );
		}

	} else {

		append( body, namedFragment( name, stack[0].type ) );

	}

	function namedFragment( name, type ) {
		return new exports.LoadFragment( name, type, args, line );
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

exports.LoadFragment = function( name, type, args, line ) {
	this.name = unwrap( name );
	this.type = type;
	this.args = args.map( unwrap );
	this.line = line;
}

exports.LoadFragment.prototype = {
	expand: function( scope, args ) {
		return evalInEnv(
					'function() {\n' +
						'return this.loadFragment(' + this.name + ',"' + this.type + '",[' + this.args.join(',') + '],$arguments);' +
					'\n}',
					scope.env, ['$arguments'], [this.args]
			   ).apply( scope, args );	
	}
}

exports.builtinFragment = function( name, type ) {

	if( !this._iplWrapped && type == "ipl" )
		this._iplWrapped = 1;
	else if( this._iplWrapped && type == "html" )
		delete this._iplWrapped;

	return (new this.LoadFragment( name, type, [] ))
			.expand( this, [] );
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
