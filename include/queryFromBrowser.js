@ global: request @

@once@
	var query =
		@@@ if( request && request.query ) { @@@
			@= request.query @
		@@@ } else { @@@
			(function( s ) {
				var r = {};
				s.replace( /([^=&]+)(=?)([^&]*)/g, function( _1, key, _2, value ){
					r[key] = value;
					return "";
				} );
				return r;
			})( window.location.search.substr( 1 ) )
		@@@ } @@@
	;
@@
