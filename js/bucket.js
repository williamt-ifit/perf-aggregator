class BucketClient {
	constructor (key) {
		this.key = key;
		this.urlBase = 'https://willgorithms.com/bucket/api';
	}

	get(id, onSuccess, onFail) {
		jQuery.ajax(
			`${this.urlBase}/get`,
			{
				method: 'GET',
				dataType: 'json',
				data: {
					key: this.key,
					id: id
				},
				success: function(data, textStatus, jqXHR) {
					if (data.success) {
						if (onSuccess) {
							onSuccess (data.result);
						}
						return;
					}

					if (onFail) {
						onFail (data.message);
					}
				},
				error: function (jqXHR, textStatus, errorThrown) {
					if (onFail) {
						onFail (errorThrown);
					}
				}
			}
		);
	}

	set(text, onSuccess, onFail) {
		jQuery.ajax(
			`${this.urlBase}/set`,
			{
				method: 'POST',
				dataType: 'json',
				data: {
					key: this.key,
					text: text
				},
				success: function(data, textStatus, jqXHR) {
					if (data.success) {
						if (onSuccess) {
							onSuccess (data.id);
						}
						return;
					}

					if (onFail) {
						onFail (data.message);
					}
				},
				error: function (jqXHR, textStatus, errorThrown) {
					if (onFail) {
						onFail (errorThrown);
					}
				}
			}
		);
	}
}
