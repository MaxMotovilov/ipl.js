// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

module.exports = function( source ) {

	var mode = '', last = 0, rewind, _this = this, line = 1,
		parts = { tag: tag, lit: lit, expr: expr, sub: sub, subx: subx },
		what, args, tagline;

	try {
		source.replace( /(?:\n|@={0,2}|:=?)/g, function( token, offset ) {
			if( token == '\n' ) {
				eol();
			} else if( token.charAt(0) == '@' ) {
				if( mode ) {
					parts[mode]( offset, true );
					mode = '';
					last = offset + 1;
				} else {
					text( offset );
					mode = { '@': 'tag', '@=': 'sub', '@==': 'subx' }[ token ];
					tagline = line;
					last = (rewind = offset) + token.length;
				}
			} else if( mode && mode != 'sub' ) {
				if( parts[mode]( offset ) ) {
					mode = { ':' : 'lit', ':=' : 'expr' }[ token ];
				} else {
					mode = '';
					text( to + token.length );
				}
				last = offset + token.length;
			}
		} );

		eol();

		if( source.length > last )
			text( source.length );

	} catch( err ) {
		err.line = line;
		throw err;
	}

	function eol() {
		if( mode ) {
			mode = '';
			last = rewind;
		}
		++line;
	}

	function text( to ) {
		_this.rawInput( source.substring( last, to ) );
	}

	function tag( to, go ) {
		what = trim( source.substring( last, to ) );

		if( what.indexOf( "\"'><" ) >= 0 ) {
			last = rewind;
			return false;
		}

		args = [];
		if( go )	generate();
		return true;
	}

	function sub( to ) {
		_this.substitution( source.substring( last, to ) );
		return true;
	}

	function subx( to ) {
		_this.substitution( source.substring( last, to ), true );
		return true;
	}

	function expr( to, go ) {
		args.push( _this.argSubstitution( trim( source.substring( last, to ) ) ) );
		if( go )	generate();
		return true;
	}

	function lit( to, go ) {
		args.push( trim( source.substring( last, to ) ) );
		if( go )	generate();
		return true;
	}

	function generate() {
		_this.tag( what, args, tagline );
	}
}

function trim( s ) {
	return s.replace( /^\s+/, '' ).replace( /\s+$/, '' );
}
