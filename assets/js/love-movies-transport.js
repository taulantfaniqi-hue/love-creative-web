const LoveCloud={async call(action,data){
 const base=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?'api/index.php':'https://api.lovecreative.ch/api/index.php';
 const response=await fetch(base+'?action='+encodeURIComponent(action),{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),cache:'no-store'});
 return response.json();
}};
