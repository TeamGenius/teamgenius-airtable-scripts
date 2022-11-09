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

    const overallTable = base.getTable('OverallScores');
    
    await deleteAllRecordsAsync(overallTable);

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
          "playerPoolName": player.playerPoolName,
          "evalGroupName": player.evalGroupName,
          "evalSession": evalSession.evalSessionName
        };
        for(const scoringForm of evalSession.scoringFormRollups){
          for(const evalCriterion of scoringForm.evalCriterionRollups){
            const fieldName = `${scoringForm.scoringFormName} - ${evalCriterion.evalCriterionName}`;
            try{
              overallTable.getField(fieldName);
            }
            catch{
              await overallTable.createFieldAsync(fieldName, 'number', {precision: 1.0});
            }
            
            playerEvalSessionRecord[`${scoringForm.scoringFormName} - ${evalCriterion.evalCriterionName}`] = evalCriterion.aggScoreValue;
          }
        }
        playerEvalSessionRecords.push(playerEvalSessionRecord);
      }    
    }
    await createBulkRecordsAsync(overallTable, playerEvalSessionRecords);
  }
  else{
    console.log('API Call Failed');
    console.log('Status Code:', apiResponse.status);
    console.log('Status Text', apiResponse.statusText);
  }
}