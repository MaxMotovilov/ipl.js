@ global: request @

if( request ) {
	request.query = 
		(require('url').parse( request.url || "", true )).query;
}
