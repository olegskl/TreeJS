var template = {
	
	className: 'MyTree',
	disableHeader: false,
	defaultLeafType: 'DefaultLeafType',
	
	columns: {
		
		name: {
			title: 'Item name'
		},
		status: {
			title: 'State',
			defaultValue: 'Idle',
			noescape: true
		},
		first: {
			title: 'First',
			defaultValue : '0'
		},
		second: {
			title: 'Second',
			defaultValue: '0'
		},
		third: {
			title: 'Third',
			defaultValue: '0'
		},
		description: {
			title: 'Description'
		}
		
	}
	
}