export const CONTROL_NAV = [
  ['adminWorkforce', [['employees','id-card','adminEmployees'],['missions','clipboard-list','adminMissions'],['inspections','clipboard-check','adminInspections']]],
  ['adminNetwork', [['docks','panel-top','adminDocks'],['rebalancing','arrow-left-right','adminRebalancing'],['devices','router','adminDevices']]],
  ['adminAutomation', [['alerts','siren','adminAlerts'],['automations','workflow','adminAutomations']]],
  ['adminBenefits', [['entitlements','gift','adminEntitlements'],['overrides','shield-alert','adminOverrides']]],
  ['adminHealth', [['system','heart-pulse','adminSystem']]]
];

export const CONTROL_VIEWS = new Set(CONTROL_NAV.flatMap(([, items]) => items.map(([view]) => view)));

export const CONTROL_COLUMNS = {
  employees: [['employee_code','adminCode'],['email','adminEmail'],['job_role','adminRole'],['team_name','adminTeam'],['availability','adminAvailability'],['status','adminStatus'],['updated_at','adminDate']],
  docks: [['public_code','adminCode'],['station_name','adminStation'],['position','#'],['bike_code','adminBike'],['status','adminStatus'],['updated_at','adminDate']],
  inspections: [['public_code','adminCode'],['inspection_type','adminCategory'],['bike_code','adminBike'],['station_name','adminStation'],['inspector_email','adminAssigned'],['due_at','adminDue'],['status','adminStatus']],
  missions: [['public_code','adminCode'],['mission_type','adminCategory'],['title','adminSubject'],['priority','adminPriority'],['assignee_email','adminAssigned'],['due_at','adminDue'],['status','adminStatus']],
  rebalancing: [['source_station','adminDeparture'],['destination_station','adminArrival'],['suggested_bikes','adminBikes'],['priority','adminPriority'],['reason','adminReason'],['status','adminStatus']],
  automations: [['public_code','adminCode'],['name','adminName'],['rule_type','adminCategory'],['severity','adminSeverity'],['last_run_at','adminLastRun'],['status','adminStatus']],
  devices: [['public_code','adminCode'],['device_type','adminCategory'],['station_name','adminStation'],['bike_code','adminBike'],['firmware_version','Firmware'],['last_seen_at','adminLastSeen'],['status','adminStatus']],
  alerts: [['detected_at','adminDate'],['severity','adminSeverity'],['alert_type','adminCategory'],['title','adminSubject'],['message','adminMessage'],['status','adminStatus']],
  entitlements: [['email','adminUser'],['benefit_type','adminBenefit'],['plan_name','adminPlan'],['starts_at','adminStart'],['ends_at','adminEnd'],['granted_by','Admin'],['status','adminStatus']],
  overrides: [['created_at','adminDate'],['actor_email','Admin'],['action','adminAction'],['target_type','adminResource'],['target_id','ID'],['reason','adminReason'],['outcome','adminStatus']]
};

export const CONTROL_STATUSES = {
  employees: ['active','inactive','suspended'], docks: ['available','occupied','maintenance','disabled'],
  inspections: ['scheduled','in_progress','passed','failed','cancelled'], missions: ['created','assigned','accepted','in_progress','completed','cancelled','failed'],
  rebalancing: ['open','accepted','dismissed','completed','expired'], automations: ['active','disabled'],
  devices: ['provisioning','online','offline','maintenance','disabled'], alerts: ['open','acknowledged','resolved','dismissed'],
  entitlements: ['active','expired','revoked'], overrides: ['applied','rejected','failed']
};

function action(actionName, targetId, fields = [], initial = {}) {
  return {
    action: actionName,
    targetId,
    fields: [
      ...fields,
      { name:'reason', label:'adminReason', type:'textarea', wide:true, required:true, minLength:10, maxLength:500 },
      { name:'confirmation', label:`PIKALA ${actionName.toUpperCase()}`, wide:true, required:true }
    ],
    initial: { ...initial },
    payload(values) {
      const data = Object.fromEntries(fields.map((field) => [field.name, values[field.name]]));
      return { action:actionName, targetId, reason:values.reason, confirmation:values.confirmation, idempotencyKey:crypto.randomUUID(), data };
    }
  };
}

export function actionFor(view, item) {
  if (view === 'employees') return action('employee.upsert', item.user_id, [
    {name:'userId',label:'adminUser',type:'number',required:true},{name:'employeeCode',label:'adminCode',required:true},
    {name:'jobRole',label:'adminRole',type:'select',options:['operator','technician','support','supervisor','finance','administrator'].map((value)=>[value,value])},
    {name:'teamName',label:'adminTeam'}
  ], {userId:item.user_id,employeeCode:item.employee_code,jobRole:item.job_role,teamName:item.team_name||''});
  if (view === 'docks') return action('dock.correct', item.id, [{name:'status',label:'adminStatus',type:'select',options:['available','maintenance','disabled'].map((value)=>[value,value])}], {status:item.status});
  if (view === 'missions') return action('mission.assign', item.id, [{name:'userId',label:'adminAssigned',type:'number',required:true}]);
  if (view === 'rebalancing') return action('mission.create', null, [
    {name:'missionType',label:'adminCategory',type:'hidden'},{name:'title',label:'adminSubject',required:true},
    {name:'priority',label:'adminPriority',type:'select',options:['low','normal','high','urgent'].map((value)=>[value,value])},
    {name:'userId',label:'adminAssigned',type:'number'},{name:'sourceStationId',label:'adminDeparture',type:'number'},
    {name:'destinationStationId',label:'adminArrival',type:'number'},{name:'dueAt',label:'adminDue',type:'datetime-local'}
  ], {missionType:'rebalancing',title:`Rééquilibrage #${item.id}`,priority:item.priority,sourceStationId:item.source_station_id,destinationStationId:item.destination_station_id});
  if (view === 'automations') return action('automation.toggle', item.id, [{name:'enabled',label:'adminActive',type:'checkbox'}], {enabled:item.status!=='active'});
  if (view === 'devices') return action('device.status', item.id, [{name:'status',label:'adminStatus',type:'select',options:['online','offline','maintenance','disabled'].map((value)=>[value,value])}], {status:item.status});
  if (view === 'alerts') return action(item.status === 'open' ? 'alert.acknowledge' : 'alert.resolve', item.id);
  if (view === 'entitlements' && item.status === 'active') return action('entitlement.revoke', item.id);
  return null;
}

export function createActionFor(view) {
  if (view === 'employees') return actionFor('employees', {user_id:null,employee_code:'',job_role:'operator',team_name:''});
  if (view === 'inspections') return action('inspection.create', null, [
    {name:'inspectionType',label:'adminCategory',type:'select',options:['bike','station','dock','safety'].map((value)=>[value,value])},
    {name:'bikeId',label:'adminBike',type:'number'},{name:'stationId',label:'adminStation',type:'number'},
    {name:'dockId',label:'adminDocks',type:'number'},{name:'userId',label:'adminAssigned',type:'number'},
    {name:'dueAt',label:'adminDue',type:'datetime-local'}
  ], {inspectionType:'bike'});
  if (view === 'missions') return action('mission.create', null, [
    {name:'missionType',label:'adminCategory',type:'select',options:['inspection','maintenance','rebalancing','intervention','recovery'].map((value)=>[value,value])},
    {name:'title',label:'adminSubject',required:true},{name:'priority',label:'adminPriority',type:'select',options:['low','normal','high','urgent'].map((value)=>[value,value])},
    {name:'userId',label:'adminAssigned',type:'number'},{name:'sourceStationId',label:'adminDeparture',type:'number'},
    {name:'destinationStationId',label:'adminArrival',type:'number'},{name:'dueAt',label:'adminDue',type:'datetime-local'}
  ], {missionType:'intervention',priority:'normal'});
  if (view === 'entitlements') return action('entitlement.grant', null, [
    {name:'userId',label:'adminUser',type:'number',required:true},{name:'benefitType',label:'adminBenefit',type:'select',options:[['ride_access','ride_access'],['subscription_extension','subscription_extension'],['service_credit','service_credit']]},
    {name:'planId',label:'adminPlan',type:'number'},{name:'days',label:'adminDuration',type:'number',min:1,max:366,required:true}
  ], {benefitType:'ride_access',days:30});
  return null;
}
