export const UAT_TEST_PHONE = /^\+276000000\d{2}$/;
export function validUatRegistration(body:{phone?:unknown;password?:unknown;code?:unknown}){
 return typeof body.phone==='string'&&UAT_TEST_PHONE.test(body.phone)&&typeof body.password==='string'&&/^Ss![a-f0-9]{64}$/.test(body.password)&&body.code==='123456';
}
