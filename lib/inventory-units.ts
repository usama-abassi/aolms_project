const normalize=(unit:string='')=>unit.trim().toLowerCase().replace(/[.\s]/g,'');
export const isPieceUnit=(unit:string='')=>['piece','pieces','piece/s','pc','pcs','ea','each'].includes(normalize(unit));
export const isMeterUnit=(unit:string='')=>['m','meter','meters','metre','metres','mtr','mtrs'].includes(normalize(unit));
export const inventoryStep=(unit:string='')=>isPieceUnit(unit)?1:0.0001;
export const inventoryQuantityLabel=(unit:string='')=>isPieceUnit(unit)?'Quantity(Piece/s)':isMeterUnit(unit)?'Length(Meter)':unit?`Quantity(${unit})`:'Quantity';
export const inventoryItemLabel=(item:{item_code:string;name:string})=>item.item_code?`${item.item_code} - ${item.name}`:item.name;
