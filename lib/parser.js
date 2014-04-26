// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

module.exports = function( source ) {

	var mode = '', last = 0, rewind, _this = this, line = 1, trim_left,
		parts = { tag: tag, lit: lit, expr: expr, sub: sub },
		what, args, tagline, sub_flags;

	try {
		source.replace( /(?:\n|@=\/?=?|@{1,3}|:=?)/g, function( token, offset ) {
			if( token == '\n' ) {
				eol();
			} else if( token == '@@' || token == '@@@' ) {
				if( mode ) {
					last = rewind;
					mode = '';
				}				
				text( offset, true );
				bracket( token == '@@@' );
				last = offset + token.length;
			} else if( token.charAt(0) == '@' ) {
				if( mode ) {
					parts[mode]( offset, true );
					mode = '';
					last = offset + 1;
				} else {
					text( offset );
					mode = { '@': 'tag', '@=': 'sub' }[ token.substr(0,2) ];
					sub_flags = token.substr( 2 );
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

	function bracket( long ) {
		_this.emptyTag( long, line );
		trim_left = true;
	}

	function text( to, trim_right ) {
		var s = source.substring( last, to );
		if( trim_right )	
			s = s.replace( /\s+$/, '' );
		if( trim_left )	
			s = s.replace( /^\s+/, '' );
		if( s.length ) {
			_this.rawInput( s );
			trim_left = false;
		}
	}

	function tag( to, go ) {
		what = trim( source.substring( last, to ) );

		if( what.indexOf( "\"'><" ) >= 0 || what.length == 0 ) {
			last = rewind;
			return false;
		}

		args = [];
		if( go )	generate();
		return true;
	}

	function sub( to ) {
		_this.substitution( source.substring( last, to ), sub_flags.indexOf( '/' ) >= 0, sub_flags.indexOf( '=' ) >= 0 );
		trim_left = false;
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
		trim_left = true;
	}
}

function trim( s ) {
	return s.replace( /^\s+/, '' ).replace( /\s+$/, '' );
}
