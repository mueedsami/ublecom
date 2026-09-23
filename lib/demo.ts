export const demoAccounts = [
  {account_code:'shajgoj',account_name:'Shajgoj',ola_pct:91,nola_count:12,scoped_basepacks:132},
  {account_code:'pandamart',account_name:'Pandamart',ola_pct:84,nola_count:37,scoped_basepacks:231},
  {account_code:'arogga',account_name:'Arogga',ola_pct:88,nola_count:16,scoped_basepacks:138},
  {account_code:'daraz',account_name:'dMart / Daraz',ola_pct:79,nola_count:29,scoped_basepacks:140},
  {account_code:'othoba',account_name:'Othoba',ola_pct:86,nola_count:18,scoped_basepacks:128},
  {account_code:'shwapno',account_name:'Shwapno',ola_pct:82,nola_count:24,scoped_basepacks:132},
]
export const demoTrend = [
  {date:'Sep 14',ola:82},{date:'Sep 15',ola:84},{date:'Sep 16',ola:83},{date:'Sep 17',ola:86},{date:'Sep 18',ola:87},{date:'Sep 19',ola:85},{date:'Sep 20',ola:86}
]
export const demoNola = [
  {account_name:'Pandamart',location_name:'Uttara',basepack:'LUX SHOWR BW BRIGHTENING VITAMIN C 245ML',brand:'Lux',reason:'all_observed_skus_unavailable'},
  {account_name:'Shajgoj',location_name:null,basepack:'DOVE SHAMPOO INTENSIVE REPAIR 340ML',brand:'Dove',reason:'all_observed_skus_unavailable'},
  {account_name:'dMart / Daraz',location_name:null,basepack:'LIFEBUOY LIQUID HAND SOAP TOTAL 200ML',brand:'Lifebuoy',reason:'no_observation'},
]
export const demoHeat = [
  {brand:'Dove',shajgoj:94,pandamart:88,arogga:91,daraz:83,othoba:90,shwapno:85},
  {brand:'Lux',shajgoj:90,pandamart:80,arogga:86,daraz:78,othoba:84,shwapno:81},
  {brand:'Ponds',shajgoj:88,pandamart:82,arogga:90,daraz:76,othoba:86,shwapno:79},
  {brand:'Lifebuoy',shajgoj:96,pandamart:86,arogga:89,daraz:82,othoba:91,shwapno:87},
  {brand:'Sunsilk',shajgoj:92,pandamart:84,arogga:87,daraz:80,othoba:88,shwapno:83},
]
export const demoCpp = [
  {campaign_name:'September CPP',account_name:'Shajgoj',basepack:'LUX SHOWR BW BRIGHTENING VITAMIN C 245ML',brand:'Lux',expected_price:499,observed_price:550,compliant:false,status:'price_mismatch'},
  {campaign_name:'September CPP',account_name:'Shajgoj',basepack:'PONDS FMCR OIL CNT SUPR LGT GEL LC 50ML',brand:'Ponds',expected_price:399,observed_price:399,compliant:true,status:'compliant'},
  {campaign_name:'September CPP',account_name:'Shajgoj',basepack:'DOVE SHAMPOO INTENSIVE REPAIR 340ML',brand:'Dove',expected_price:625,observed_price:650,compliant:false,status:'price_mismatch'},
]
export const demoSos = [
  {account_name:'Pandamart',keyword:'Soap',basepack:'LUX SKIN CLEANSING BAR SOFT TOUCH 100G',brand:'Lux',position:2,found:true},
  {account_name:'Pandamart',keyword:'Bath Soap',basepack:'DOVE SKN CLNSNG BAR PINK LC 90G',brand:'Dove',position:4,found:true},
  {account_name:'Shajgoj',keyword:'Body Wash',basepack:'LUX SHOWR BW BRIGHTENING VITAMIN C 245ML',brand:'Lux',position:1,found:true},
  {account_name:'Shajgoj',keyword:'Shampoo',basepack:'DOVE SHAMPOO INTENSIVE REPAIR 340ML',brand:'Dove',position:null,found:false},
]
