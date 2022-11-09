await main();
async function main() {
  const createBulkRecords = async (table, data) => {
    const pageSize = 50.0;
    for(let pageIndex = 0; pageIndex < Math.ceil(data.length / pageSize); pageIndex++)
    {
      await table.createRecordsAsync(data.slice(pageIndex * pageSize, pageSize * (pageIndex + 1)).map(x => {return {fields: x}}));
    }
  }

  const deleteAllRecordsAsync = async (table) => {
    const pageSize = 50.0;
    const data = (await table.selectRecordsAsync({fields: []})).recordIds;
    for(let pageIndex = 0; pageIndex < Math.ceil(data.length / pageSize); pageIndex++)
    {
      const ids = data.slice(pageIndex * pageSize, pageSize * (pageIndex + 1));    
      await table.deleteRecordsAsync(ids);
    }
  }

  const username = await input.textAsync('Email used with TeamGenius');
  const password = await input.textAsync('Password used with TeamGenius');
  //const username = '<EMAIL>';
  //const password = '<PASSWORD>';

  const authHeaderValue = 'Basic ' + btoa(username + ":" + password);
  const host = 'https://api.teamgenius.com';
  const apiResponse  = await remoteFetchAsync(host+'/v1/assessments', { 
      method: 'GET', 
      headers: {
        "Authorization": authHeaderValue
      }
  });

  if(!apiResponse.ok)
  {
    console.log('API Call Failed');
    console.log('Status Code:', apiResponse.status);
    console.log('Status Text', apiResponse.statusText);
  }
  console.log('API Call Succeeded');
  const data = await apiResponse.json();

  const table = base.getTable('Assessments');

  await deleteAllRecordsAsync(table);

  await createBulkRecords(table, data);  
}