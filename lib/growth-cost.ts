/** USD per 1M tokens. These are estimates and must be refreshed when provider pricing changes. */
const USD_PER_MILLION:Record<string,{input:number;output:number}>={
 'gpt-4.1-mini':{input:0.4,output:1.6},
 'gpt-4.1-nano':{input:0.1,output:0.4},
 'gpt-4.1':{input:2,output:8},
 'gpt-4o-mini':{input:0.15,output:0.6},
 'gpt-4o':{input:2.5,output:10},
};
export function estimateOpenAICost(model:string,inputTokens:number,outputTokens:number){
 const price=USD_PER_MILLION[model];if(!price)return 0;
 const usd=(Math.max(0,inputTokens)*price.input+Math.max(0,outputTokens)*price.output)/1_000_000;
 const rate=Number(process.env.USD_TO_INR_ESTIMATE||85);return Number((usd*rate).toFixed(6));
}
