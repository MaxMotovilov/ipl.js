// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

module.exports = function( source ) {

	var mode = '', last = 0, _this = this, line = 1,
		parts = { tag: tag, lit: lit, expr: expr, sub: sub, subx: subx },
		what, args, tagline;

	try {
		source.replace( /(?:\n|@={0,2}|:=?)/g, function( token, offset ) {
			if( token == '\n' ) {
				++line;
			} else if( token.charAt(0) == '@' ) {
				if( mode ) {
					parts[mode]( offset, true );
					mode = '';
					last = offset + 1;
				} else {
					text( offset );
					mode = { '@': 'tag', '@=': 'sub', '@==': 'subx' }[ token ];
					last = offset + token.length;
				}
			} else if( mode && mode != 'sub' ) {
				parts[mode]( offset );
				mode = { ':' : 'lit', ':=' : 'expr' }[ token ];
				last = offset + token.length;
			}
		} );

		text( source.length );
	} catch( err ) {
		err.line = line;
		throw err;
	}

	function text( to ) {
		_this.rawInput( source.substring( last, to ) );
	}

	function tag( to, go ) {
		what = trim( source.substring( last, to ) );
		tagline = line;
		args = [];
		if( go )	generate();
	}

	function sub( to ) {
		_this.substitution( source.substring( last, to ) );
	}

	function subx( to ) {
		_this.substitution( source.substring( last, to ), true );
	}

	function expr( to, go ) {
		args.push( _this.argSubstitution( trim( source.substring( last, to ) ) ) );
		if( go )	generate();
	}

	function lit( to, go ) {
		args.push( trim( source.substring( last, to ) ) );
		if( go )	generate();
	}

	function generate() {
		_this.tag( what, args, tagline );
	}
}

function trim( s ) {
	return s.replace( /^\s+/, '' ).replace( /\s+$/, '' );
}
