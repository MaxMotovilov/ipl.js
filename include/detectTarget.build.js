@ once @
	var known$Targets = {
			ios: {
				context: "ip(?:hone|od|ad)",

				value: function( c ) { return { 
					name: "ios",
					device: c.toLowerCase(), 
					version: function(){
						return /OS (\d+)_(\d+)(?:_(\d+))?/
								.exec( navigator.appVersion )
								.slice( 1 )
								.map( function(x) { return parseInt( x||0, 10 ); } )
						;
					}
				} }
			},

			android: {
				context: "android",
				value: { name: "android" }
			},
		
			msie: {
				context: "msie",
				value: { name: "msie" }
			}
		},

		requested$Targets = { contexts: [], values: [] };

	function detectTarget( str ) {
		var m =	(new RegExp( "\\b(?:" + requested$Targets.contexts.join( "|" ) + ")\\b", "i" )).exec( str );
		if( m ) 
			for( var i=1; i<m.length; ++i )
				if( m[i] )
					return make$Target( requested$Targets.values[i-1], m[i] );
	}

	function make$Target( v, m ) {
		return typeof v === 'function' ? v( m ) : v;
	}
@@

arguments[0].replace( /\w+/g, function( name ) {
	requested$Targets.contexts.push( "(" + known$Targets[name].context + ")" );
	requested$Targets.values.push( known$Targets[name].value );
} );

