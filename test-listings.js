fetch('https://maklersizkvartira-production.up.railway.app/api/v1/listings')
  .then(res => res.json())
  .then(data => {
    console.log('Total count:', data.totalCount);
    data.data.forEach(l => console.log(l.id, l.district, l.rooms, l.price));
  })
  .catch(console.error);
