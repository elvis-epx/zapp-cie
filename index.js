var fs = require('fs'),
    Ziee = require('ziee'),
    Zive = require('zive'),
    zclId = require('zcl-id'),
    Objectbox = require('objectbox');

var cieClusters = new Ziee(),
    zoneNumber = 0;

/***************************************************/
/*** Init Cluster Direction                      ***/
/***************************************************/
cieClusters.init('genBasic',    'dir', { value: 1 });  // Server Side(Input)
cieClusters.init('ssIasAce',    'dir', { value: 1 });  // Server Side(Input)
cieClusters.init('ssIasZone',   'dir', { value: 2 });  // Client Side(Output)
cieClusters.init('ssIasWd',     'dir', { value: 2 });  // Client Side(Output)
cieClusters.init('genIdentify', 'dir', { value: 3 });  // Server and Client Side(Input/Output)

/***************************************************/
/*** Init Attributes Access Control              ***/
/***************************************************/
cieClusters.init('genBasic', 'acls', {
    zclVersion:       'R',
    hwVersion:        'R',
    manufacturerName: 'R',
    modelId:          'R',
    dateCode:         'R',
    powerSource:      'R',
    locationDesc:     'RW',
    physicalEnv:      'RW',
    deviceEnabled:    'RW'
});

cieClusters.init('genIdentify', 'acls', {
    identifyTime: 'RW'
});

/***************************************************/
/*** Init Attributes Value                       ***/
/***************************************************/
cieClusters.init('genBasic', 'attrs', {
    zclVersion: 1,
    hwVersion: 1,
    manufacturerName: 'sivann inc.',
    modelId: 'hiver0001',
    dateCode: '20170407',
    powerSource: 1,
    locationDesc: '    ',
    physicalEnv: 0,
    deviceEnabled: 1
});

cieClusters.init('genIdentify', 'attrs', {
    identifyTime: 0
});

/***************************************************/
/*** Init Command Response Handler               ***/
/***************************************************/
cieClusters.init('ssIasZone', 'cmdRsps', {
    enrollReq: function (zapp, argObj, cb) {
        // argObj = { src, zonetype, manucode }
        var ieeeAddr = argObj.src.ieeeAddr,
            epId = argObj.src.epId,
            writeRec = {
                attrId: zclId.attr('ssIasZone', 'iasCieAddr').value,
                dataType: zclId.attrType('ssIasZone', 'iasCieAddr').value,
                attrData: zapp._endpoint.getIeeeAddr()
            },
            enrollRspArgs = {
                enrollrspcode: 0x00,
                zoneid : nextZoneId()
            };

        zapp.foundation(ieeeAddr, epId, 'ssIasZone', 'write', [ writeRec ], { direction: 0 },function (err, rsp) {
            if (err) {
                console.log('Write iasCieAddr attribute error: ' + err);
            } else {
                zapp.functional(ieeeAddr, epId, 'ssIasZone', 'enrollRsp', enrollRspArgs, { direction: 0 }, function (err, rsp) {
                        if (err) {
                            console.log('Device: ' + ieeeAddr + ' enroll error: ' + err);
                        } else {
                            console.log('Device: ' + ieeeAddr + ' enroll successfully! ZoneType: ' + getZoneType(argObj.zonetype));
                            var cieInfo = {
                                ieeeAddr: ieeeAddr,
                                epId: epId,
                                zoneId: enrollRspArgs.zoneid,
                                zoneType: getZoneType(argObj.zonetype),
                            };

                            cieApp._ciebox.set(cieInfo.zoneId, cieInfo, function (err) {
                                if (err) console.log(err);
                            });
                        }
                    }
                );
            }
        });
    },
    statusChangeNotification: function (zapp, argObj, cb) {
        // argObj = { src, zonestatus, extendedstatus }
        var ZONE_STATUS_BITS = [
                'alarm1',
                'alarm2',
                'tamper',
                'battery',
                'supervisionReports',
                'restoreReports',
                'trouble',
                'ac',
                'test',
                'batteryDefect'
            ],
            ieeeAddr = argObj.src.ieeeAddr,
            epId = argObj.src.epId,
            zoneStatus = argObj.zonestatus,
            status = {};

        ZONE_STATUS_BITS.forEach(function (name, bit) {
            status[name] = !!((zoneStatus >> bit) & 0x0001);
        });

        console.log('Device: ' + ieeeAddr + ' IAS zone status change:');
        console.log(status);
    }
});

function nextZoneId() {
    var ids = cieApp._ciebox.exportAllIds(),
        maxZoneId;

    if (ids.length) {
        maxZoneId = Math.max.apply(null, ids);
        zoneNumber = maxZoneId + 1;
    } else {
        zoneNumber = 1;
    }

    cieApp._zoneId = zoneNumber;

    return zoneNumber;
}

function getZoneType(zoneType) {
    switch (zoneType) {
        case 0x0000:
            return 'standardCie';
        case 0x000D:
            return 'motionSensor';
        case 0x0015:
            return 'contactSwitch';
        case 0x0028:
            return 'fireSensor';
        case 0x002A:
            return 'waterSensor';
        case 0x002B:
            return 'gasSensor';
        case 0x002C:
            return 'personalEmergencyDevice';
        case 0x002D:
            return 'vibrationMovementSensor';
        case 0x010F:
            return 'remoteControl';
        case 0x0115:
            return 'keyFob';
        case 0x021D:
            return 'keypad';
        case 0x0225:
            return 'standardWarningDevice';
        case 0x0226:
            return 'glassBreakSensor';
        case 0x0229:
            return 'securityRepeater';
        case 0xFFFF:
            return 'invalidZoneType';
        default:
            return 'unknown';
    }
}

var cieApp = new Zive({ profId: 0x0104, devId: 0x0400, discCmds: [] }, cieClusters);

try {
    fs.statSync(__dirname + '/database');
} catch (e) {
    fs.mkdirSync(__dirname + '/database');
}

cieApp._ciebox = new Objectbox(__dirname + '/database/cie.db', 256);
cieApp._zoneId = 0;

module.exports = cieApp;
