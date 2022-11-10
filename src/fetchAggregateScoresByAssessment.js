await main();
async function main(){
  const table = base.getTable("Assessments");
  const record = await input.recordAsync('Pick an Assessment', table);

  if (!record) {
    output.text('Assessment Results Not Found!');
    return;    
  }

  const assessmentId = record.getCellValueAsString("id");
  let assessmentName = record.getCellValueAsString("name");
  output.text(`You picked ${record.getCellValueAsString("name")}`);

  const createBulkRecordsAsync = async (table, data) => {
    const pageSize = 50.0;
    for(let pageIndex = 0; pageIndex < Math.ceil(data.length / pageSize); pageIndex++)
    {
      await table.createRecordsAsync(data.slice(pageIndex * pageSize, pageSize * (pageIndex + 1)).map(x => {return {fields: x}}));
    }
  }

  const updateBulkRecordsAsync = async (table, data) => {
    const pageSize = 50.0;
    for(let pageIndex = 0; pageIndex < Math.ceil(data.length / pageSize); pageIndex++)
    {
      const mappedData = data.slice(pageIndex * pageSize, pageSize * (pageIndex + 1)).map(x => {return {id: x.existingRecord.id, fields: x.newRecord}});
      await table.updateRecordsAsync(mappedData)
    }
  }

  // const deleteAllRecordsAsync = async (table) => {
  //   const pageSize = 50.0;
  //   const data = (await table.selectRecordsAsync({fields: []})).recordIds;
  //   for(let pageIndex = 0; pageIndex < Math.ceil(data.length / pageSize); pageIndex++)
  //   {
  //     const ids = data.slice(pageIndex * pageSize, pageSize * (pageIndex + 1));    
  //     await table.deleteRecordsAsync(ids);
  //   }
  // }


  const username = await input.textAsync('Email used with TeamGenius');
  const password = await input.textAsync('Password used with TeamGenius');
  //const username = '<EMAIL>';
  //const password = '<PASSWORD>';

  const authHeaderValue = 'Basic ' + btoa(username + ":" + password);
  const host = 'https://api.teamgenius.com';
  const apiResponse  = await remoteFetchAsync(host+'/v1/results/'+assessmentId+'/3?take=5000', { 
      method: 'GET', 
      headers: {
        "Authorization": authHeaderValue
      }
  });

  if(apiResponse.ok)
  {
    console.log('API Call Succeeded');
    const data = await apiResponse.json();  
    console.log('Data', data);
    const table = base.getTable('OverallScores');
    
    //await deleteAllRecordsAsync(table);

    const playerEvalSessionRecords = [];
    //Write overall records
    for(const player of data) {
      for(const evalSession of player.rollups) {
        const playerEvalSessionRecord = {
          "playerId": player.playerId,
          "playerFirstName": player.playerFirstName,
          "playerLastName": player.playerLastName,
          "birthdate": player.birthdate,
          "position": player.position,
          "assessmentId": assessmentId,
          "assessmentName": assessmentName,
          "playerPoolId": player.playerPoolId,
          "playerPoolName": player.playerPoolName,
          "evalGroupName": player.evalGroupName,
          "evalSessionId": evalSession.evalSessionId,
          "evalSessionName": evalSession.evalSessionName
        };
        for(const scoringForm of evalSession.scoringFormRollups){
          for(const evalCriterion of scoringForm.evalCriterionRollups){
            const fieldName = `${scoringForm.scoringFormName} - ${evalCriterion.evalCriterionName}`;
            try{
              table.getField(fieldName);
            }
            catch{
              await table.createFieldAsync(fieldName, 'number', {precision: 1.0});
            }
            
            playerEvalSessionRecord[`${scoringForm.scoringFormName} - ${evalCriterion.evalCriterionName}`] = evalCriterion.aggScoreValue;
          }
        }
        playerEvalSessionRecords.push(playerEvalSessionRecord);
      }    
    }
    
    const existingRecords = await table.selectRecordsAsync({fields: ['playerId', 'playerPoolId', 'evalSessionId']});
    console.log(existingRecords);
    
    const mappedRecords = playerEvalSessionRecords.map(x => { return { 
        newRecord: x, 
        existingRecord: existingRecords.records.find(y => 
          y.getCellValueAsString('playerId') == x.playerId && 
          y.getCellValueAsString('playerPoolId') == x.playerPoolId && 
          y.getCellValueAsString('evalSessionId') == x.evalSessionId) 
      } 
    });
    console.log('Mapped Records', mappedRecords);

    const recordsToUpdate = mappedRecords.filter(x => x.existingRecord != null);
    console.log('Records to Update', recordsToUpdate);
    
    const recordsToCreate = mappedRecords.filter(x => x.existingRecord == null);
    console.log('Records to Create', recordsToCreate);

    await createBulkRecordsAsync(table, recordsToCreate.map(x => x.newRecord));
    await updateBulkRecordsAsync(table, recordsToUpdate);
  }
  else{
    console.log('API Call Failed');
    console.log('Status Code:', apiResponse.status);
    console.log('Status Text', apiResponse.statusText);
  }
}