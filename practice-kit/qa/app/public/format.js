function formatMoney(amount) {
  var satang = Math.round(Number(amount) * 100);
  var negative = satang < 0;
  satang = Math.abs(satang);
  var whole = String(Math.floor(satang / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  var fraction = String(satang % 100).padStart(2, '0');
  return (negative ? '-' : '') + whole + '.' + fraction;
}

function formatThaiDate(isoDate) {
  var parts = String(isoDate).split('-');
  return parts[2] + '/' + parts[1] + '/' + (Number(parts[0]) + 543);
}

function sumNet(rows) {
  var total = 0;
  for (var i = 0; i < rows.length; i++) {
    total += Math.round(rows[i].net * 100);
  }
  return total / 100;
}
