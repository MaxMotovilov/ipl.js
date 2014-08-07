@ global: request @

@once@
	var query = 
		@@@ if( request && request.query ) { @@@
			@= request.query @
		@@@ } else { @@@
			(function( s ) {
				var r = {},
					splittedParams = s.split('&');
				for (var i = 0, e = splittedParams[i]; i < splittedParams.length; i++, e = splittedParams[i]) {
					e = e.split('=');
					r[e[0]] = e[1] || "";
				}
				return r;
			})( window.location.search.substr( 1 ) )
		@@@ } @@@
	;
@@
