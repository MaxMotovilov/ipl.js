@ global: request @

@ detectTarget:= arguments[0] @

@ once @
	var target;
@@

if( request && request.headers && request.headers['user-agent'] )
	target = detectTarget( request.headers['user-agent'] );

