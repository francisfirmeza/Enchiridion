const supabaseUrl = 'https://dycoodprngjtzculnzwo.supabase.co';
const supabaseKey = 'sb_publishable_X6dRRdO5fzd3rnz4oRS8Tg_eQwmEy5J';
const client = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => 
{
    document.getElementById('workout-form').addEventListener('submit', async(e) =>  
    {
        e.preventDefault();
        const weight = document.getElementById('weight').value;

        const { data, error } = await client
            .from('Fun')
            .insert({ Weight: weight });

        if(error)
        {
            console.error('Error:', error.message);
        }
        else
        {
            console.log('Saved', data);
        }
    });
});

