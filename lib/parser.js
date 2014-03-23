// Copyright (C) 2014, 12 Quarters Consulting
// All rights reserved.
// Redistribution and use are permitted under the modified BSD license
// available at https://raw.githubusercontent.com/MaxMotovilov/ipl.js/master/LICENSE

module.exports = function( source ) {

	var mode = '', last = 0, _this = this,
		parts = { tag: tag, lit: lit, expr: expr, sub: sub, subx: subx },
		what, args;

	source.replace( /(?:@={0,2}|:=?)/g, function( token, offset ) {
		if( token.charAt(0) == '@' ) {
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

	function text( to ) {
		_this.rawInput( source.substring( last, to ) );
	}

	function tag( to, go ) {
		what = source.substring( last, to );
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
		args.push( source.substring( last, to ) );
		if( go )	generate();
	}

	function lit( to, go ) {
		args.push( '"' + source.substring( last, to ).replace( /["\\]/g, '\\$&' ).replace( /\s+/g, ' ' ) + '"' );
		if( go )	generate();
	}

	function generate() {
		_this.tag( what, args );
	}
}

